import { randomUUID } from "node:crypto";
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { generateImage, generateText } from "ai";
import { google } from "@ai-sdk/google";
import { INTERESTS, PET_SPECIES, PET_TRAITS } from "@bsocial/shared";
import { db, pets, places, posts, users } from "@bsocial/db";
import { getPetModel } from "./ai";
import { storeImage } from "./images";
import { attachPostMedia } from "./post-media";
import type { Bbox } from "./places";

/**
 * Seed data: "stray" pets and the posts they write about nearby places.
 *
 * Strays are marked `users.isMock`, which is what keeps them honest — the apps
 * badge them, they're excluded from friend matching, and `deleteStrays()` can
 * remove every trace of them. They are never presented as real people: their
 * posts are written by the pet and carry the "by pet" badge like any other
 * agent-written post.
 *
 * The text is generated from the place's own facts (name, category, time of
 * day). Nothing is copied from anyone else's reviews.
 */

const POST_MAX_LENGTH = 220;

/**
 * Photos are generated, not collected: the place datasets don't license their
 * photos for re-hosting. They go through the same object storage as avatar
 * uploads (S3 when configured, public/uploads in dev).
 */
export const SEED_IMAGE_MODEL = "gemini-2.5-flash-image";

const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]!;
const pickSome = <T>(list: readonly T[], count: number): T[] =>
  [...list].sort(() => Math.random() - 0.5).slice(0, count);

export type Stray = { userId: string; petId: string; petName: string; species: string; interests: string[] };

/** Create `count` stray pets. They have no password and can't sign in. */
export async function createStrays(count: number): Promise<Stray[]> {
  const made: Stray[] = [];
  for (let i = 0; i < count; i++) {
    const species = pick(PET_SPECIES);
    const petName = pick(species.names);
    const id = `stray_${randomUUID()}`;
    const handle = `${petName.toLowerCase()}.${randomUUID().slice(0, 6)}`;
    const interests = pickSome(
      INTERESTS.map((i) => i.value),
      2 + Math.floor(Math.random() * 3),
    );

    await db.insert(users).values({
      id,
      name: petName,
      // Non-routable: these accounts exist to post, never to receive anything.
      email: `${handle}@stray.tielo.invalid`,
      emailVerified: false,
      username: handle,
      displayUsername: handle,
      isMock: true,
      interests,
      // Marked complete so they behave like any other account in feed queries.
      onboardingCompletedAt: new Date(),
    });

    const [pet] = await db
      .insert(pets)
      .values({
        userId: id,
        name: petName,
        species: species.value,
        traits: pickSome(PET_TRAITS, 2),
        autoApprove: true,
        autonomyConsentedAt: new Date(),
      })
      .returning({ id: pets.id });

    made.push({ userId: id, petId: pet!.id, petName, species: species.value, interests });
  }
  return made;
}

export async function listStrays(): Promise<Stray[]> {
  const rows = await db
    .select({
      userId: users.id,
      petId: pets.id,
      petName: pets.name,
      species: pets.species,
      interests: users.interests,
    })
    .from(users)
    .innerJoin(pets, eq(pets.userId, users.id))
    .where(eq(users.isMock, true));
  return rows;
}

/** Remove every seeded account and, by cascade, its pet and posts. */
export async function deleteStrays(): Promise<number> {
  const gone = await db.delete(users).where(eq(users.isMock, true)).returning({ id: users.id });
  return gone.length;
}

const TIME_OF_DAY = ["early morning", "late morning", "lunchtime", "afternoon", "early evening", "late evening"];

/** One post about one place, in the pet's voice. Returns null if unusable. */
export async function writePlacePost(
  pet: { name: string; species: string; traits: string[] },
  place: { name: string; category: string | null; address: string | null },
): Promise<string | null> {
  const species = PET_SPECIES.find((s) => s.value === pet.species)?.label.toLowerCase() ?? "pet";
  const { text } = await generateText({
    model: getPetModel(),
    instructions: `You are ${pet.name}, a stray ${species} wandering a city in a social app, posting about places you pass.
Voice: ${pet.traits.join(", ") || "curious"}. Write ONE short post (max ${POST_MAX_LENGTH} characters).
Be specific to this place and grounded in what a passer-by would notice — the smell, the queue, the light, the noise.
Casual, first person, no hashtags, at most one emoji, never mention being an AI. Reply with the post text only.`,
    prompt: `Place: ${place.name}
Type: ${place.category ?? "somewhere"}
${place.address ? `Address: ${place.address}\n` : ""}Time: ${pick(TIME_OF_DAY)}

Write your post.`,
  });

  const cleaned = text
    .trim()
    .replace(/^["'`]|["'`]$/g, "")
    .slice(0, POST_MAX_LENGTH)
    .trim();
  return cleaned.length > 10 ? cleaned : null;
}

/**
 * A photo the pet supposedly took at the place, stored as a card-sized WebP and
 * a thumbnail. Returns null when generation failed — a post without a picture is
 * still fine.
 */
export async function makePlaceImage(
  place: { name: string; category: string | null },
): Promise<{ url: string; thumbUrl: string } | null> {
  try {
    const { image } = await generateImage({
      model: google.image(SEED_IMAGE_MODEL),
      prompt:
        `A casual phone snapshot at ${place.name}, a ${place.category ?? "place"} — ` +
        `street-level, natural light, slightly imperfect framing, no people's faces, no text or logos. ` +
        `Warm, everyday, like a photo taken on the way past.`,
      aspectRatio: "4:3",
    });

    const stored = await storeImage("posts", new Uint8Array(image.uint8Array));
    return { url: stored.url, thumbUrl: stored.thumbUrl };
  } catch (error) {
    console.warn("[seed] image generation failed:", (error as Error).message);
    return null;
  }
}

export type SeedResult = { written: number; skipped: number; strays: number; images: number };

/**
 * Fill an area with posts: pick places, hand each to a stray, write and store.
 * Posts sit at their place's coordinates, so they land on real venues.
 */
export async function seedPostsForArea(
  bbox: Bbox,
  options: { count: number; strayCount?: number; spreadDays?: number; withImages?: number } = { count: 20 },
): Promise<SeedResult> {
  const { count, strayCount = 6, spreadDays = 5, withImages = 0 } = options;

  let strays = await listStrays();
  if (strays.length < strayCount) {
    strays = [...strays, ...(await createStrays(strayCount - strays.length))];
  }

  // Places we haven't already posted about, nearest-first would bias one block,
  // so take a random spread across the area.
  const candidates = await db
    .select({
      id: places.id,
      name: places.name,
      category: places.category,
      address: places.address,
      latitude: places.latitude,
      longitude: places.longitude,
    })
    .from(places)
    .where(
      and(
        gte(places.latitude, bbox.south),
        lte(places.latitude, bbox.north),
        gte(places.longitude, bbox.west),
        lte(places.longitude, bbox.east),
        sql`not exists (select 1 from ${posts} where ${posts.placeId} = ${places.id})`,
      ),
    )
    .orderBy(sql`random()`)
    .limit(count);

  let written = 0;
  let skipped = 0;
  let images = 0;
  for (const place of candidates) {
    const stray = pick(strays);
    const [pet] = await db.select().from(pets).where(eq(pets.id, stray.petId));
    if (!pet) continue;

    const content = await writePlacePost(pet, place).catch(() => null);
    if (!content) {
      skipped++;
      continue;
    }

    // Images are the expensive part, so only the first `withImages` get one.
    let photo: { url: string; thumbUrl: string } | null = null;
    if (images < withImages) {
      photo = await makePlaceImage(place);
      if (photo) images++;
    }

    // Spread over recent days so the feed isn't one wall of identical timestamps.
    const createdAt = new Date(Date.now() - Math.random() * spreadDays * 24 * 60 * 60 * 1000);
    const [row] = await db
      .insert(posts)
      .values({
        petId: pet.id,
        placeId: place.id,
        content,
        latitude: place.latitude,
        longitude: place.longitude,
        authoredByAgent: true,
        createdAt,
      })
      .returning({ id: posts.id });
    if (photo) await attachPostMedia(row!.id, [{ url: photo.url, thumbUrl: photo.thumbUrl }]);
    written++;
  }

  return { written, skipped, strays: strays.length, images };
}

/** How many posts an area already has — the check before seeding more. */
export async function countPostsIn(bbox: Bbox): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(posts)
    .where(
      and(
        gte(posts.latitude, bbox.south),
        lte(posts.latitude, bbox.north),
        gte(posts.longitude, bbox.west),
        lte(posts.longitude, bbox.east),
      ),
    );
  return row?.count ?? 0;
}

export { inArray };

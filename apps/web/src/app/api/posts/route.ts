import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, pets, places, posts } from "@bsocial/db";
import { requireSession } from "@/lib/session";
import { inngest } from "@/inngest/client";
import { awardXpQuietly } from "@/lib/bond";
import { attachPostMedia, MAX_POST_MEDIA } from "@/lib/post-media";

export const MAX_POST_LENGTH = 500;
/**
 * Coordinates are stored coarse (3 decimal places, ~110 m) so a post says which
 * block you were on, not which building.
 */
const COORD_PRECISION = 3;

const mediaSchema = z.object({
  url: z.string().url().max(2048),
  thumbUrl: z.string().url().max(2048).optional(),
  kind: z.enum(["image", "video"]).default("image"),
});

const bodySchema = z.object({
  content: z.string().trim().min(1).max(MAX_POST_LENGTH),
  /** Up to MAX_POST_MEDIA photos/videos, already uploaded — see /api/uploads. */
  media: z.array(mediaSchema).max(MAX_POST_MEDIA).default([]),
  /** A post can be attached to a place; it then sits at the place's coordinates. */
  placeId: z.string().uuid().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

const coarse = (value: number) => Number(value.toFixed(COORD_PRECISION));

/**
 * A post written by the person themselves.
 *
 * Posts hang off the pet row (one pet per user, so it identifies the account);
 * `authoredByAgent: false` is what marks this as the person's own words, and the
 * apps render it under their name and photo rather than the pet's.
 */
export async function POST(req: Request) {
  const { session, response } = await requireSession();
  if (response) return response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_post" }, { status: 400 });
  const { content, media, placeId, latitude, longitude } = parsed.data;

  const [pet] = await db.select({ id: pets.id }).from(pets).where(eq(pets.userId, session.user.id));
  if (!pet) return NextResponse.json({ error: "no_pet" }, { status: 409 });

  // A chosen place wins over the device's own position: it puts the post on a
  // real venue rather than wherever the poster happened to be standing.
  let at: { latitude: number; longitude: number } | null = null;
  if (placeId) {
    const [place] = await db.select().from(places).where(eq(places.id, placeId));
    if (!place) return NextResponse.json({ error: "unknown_place" }, { status: 400 });
    at = { latitude: place.latitude, longitude: place.longitude };
  } else if (latitude !== undefined && longitude !== undefined) {
    // Both or neither: one coordinate can't be placed on the map.
    at = { latitude: coarse(latitude), longitude: coarse(longitude) };
  }

  const [post] = await db
    .insert(posts)
    .values({
      petId: pet.id,
      placeId,
      content,
      latitude: at?.latitude ?? null,
      longitude: at?.longitude ?? null,
      authoredByAgent: false,
    })
    .returning();

  await attachPostMedia(post!.id, media);
  awardXpQuietly(pet.id, "wrote_post");

  // Classification runs out of band (see inngest/classify-post.ts): the post is
  // already live, and a slow model must never be able to fail a write.
  await inngest.send({ name: "post/created", data: { postId: post!.id } }).catch((error) => {
    console.error("[posts] failed to queue classification:", error);
  });

  return NextResponse.json({ post: { ...post, media } }, { status: 201 });
}

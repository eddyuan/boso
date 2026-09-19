import { and, desc, eq, gt, isNotNull, sql } from "drizzle-orm";
import { generateText } from "ai";
import { db, pets, posts, users } from "@bsocial/db";
import { getPetModel } from "./ai";
import { amplifiedPosts } from "./visibility";
import { recordApiCallQuietly } from "./api-spend";
import { languageInstruction } from "./locale";
import type { Locale } from "@bsocial/shared";

/**
 * "A ramen feud is brewing on the Drive."
 *
 * One line of local gossip a day, in the pet's voice, built only from posts
 * that are genuinely nearby and genuinely recent. The rule that keeps it worth
 * reading is that it may never invent: if there's nothing happening, there's no
 * line, because a fabricated one is indistinguishable from noise and costs the
 * feature its credibility the first time someone taps through.
 */

const NEARBY_RADIUS_M = 5_000;
const LOOKBACK_HOURS = 36;
const EARTH_RADIUS_M = 6_371_000;
/** Below this there isn't enough happening to say anything about. */
const MIN_POSTS = 3;

export type WhiskersSource = { id: string; content: string; petName: string; placeName: string | null };

/** Recent nearby posts by other people — the raw material and the citations. */
export async function gatherLocalNews(
  userId: string,
  latitude: number,
  longitude: number,
): Promise<WhiskersSource[]> {
  const since = new Date(Date.now() - LOOKBACK_HOURS * 3600 * 1000);
  const latDelta = (NEARBY_RADIUS_M / EARTH_RADIUS_M) * (180 / Math.PI);
  const lngDelta = latDelta / Math.max(Math.cos((latitude * Math.PI) / 180), 0.01);

  return db
    .select({
      id: posts.id,
      content: posts.content,
      petName: pets.name,
      placeName: sql<string | null>`null`,
    })
    .from(posts)
    .innerJoin(pets, eq(pets.id, posts.petId))
    .innerJoin(users, eq(users.id, pets.userId))
    .where(
      and(
        isNotNull(posts.latitude),
        isNotNull(posts.longitude),
        sql`${posts.latitude} between ${latitude - latDelta} and ${latitude + latDelta}`,
        sql`${posts.longitude} between ${longitude - lngDelta} and ${longitude + lngDelta}`,
        gt(posts.createdAt, since),
        sql`${users.id} <> ${userId}`,
        amplifiedPosts(),
      ),
    )
    .orderBy(desc(posts.createdAt))
    .limit(12);
}

export function enoughToTalkAbout(sources: WhiskersSource[]): boolean {
  return sources.length >= MIN_POSTS;
}

export async function writeWhiskersLine(
  petName: string,
  sources: WhiskersSource[],
  locale: Locale,
): Promise<string> {
  recordApiCallQuietly({ provider: "gemini", kind: "text", meta: { site: "whiskers_line" } });
  const { text } = await generateText({
    model: getPetModel(),
    system: `You are ${petName}, passing on neighbourhood gossip you picked up while out.

ONE sentence, under 140 characters. Playful, a little conspiratorial.
Base it ONLY on the posts below — never invent an event, a place or a name.
Find the thread connecting several of them if there is one; otherwise pick the
most interesting single thing. No hashtags, no greeting, no quotation marks.
${languageInstruction(locale)} The posts below may be in other languages; summarise them in yours.`,
    prompt: `Posts from around the neighbourhood in the last day and a half:
${sources.map((s) => `- ${s.petName}: ${s.content}`).join("\n")}

What's the word on the street?`,
  });

  return text.trim().replace(/^["']|["']$/g, "").slice(0, 200);
}

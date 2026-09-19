import { NextResponse } from "next/server";
import { and, desc, eq, gt, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import { comments, db, likes, pets, posts, users } from "@bsocial/db";
import { mediaByPostId } from "@/lib/post-media";
import { recordInteraction } from "@/lib/relationships";
import { requireSession } from "@/lib/session";
import { effectiveInterests, topicsByPostId } from "@/lib/topics";
import { amplifiedPosts } from "@/lib/visibility";

/**
 * Send the pet somewhere on the map; it comes back with a handful of posts.
 *
 * The pet already flies across the map and "brings things back" as pure
 * decoration. This is the version you can press: you choose where, and what it
 * returns is genuinely from there and genuinely ranked for you.
 *
 * Fetching counts as the pet visiting those posts, so an errand feeds the same
 * relationship ledger everything else does.
 */

const ERRAND_RADIUS_M = 800;
const LOOKBACK_HOURS = 72;
const BUNDLE_SIZE = 4;
const EARTH_RADIUS_M = 6_371_000;

const bodySchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export async function POST(req: Request) {
  const { session, response } = await requireSession();
  if (response) return response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { latitude, longitude } = parsed.data;

  const [myPet] = await db.select({ id: pets.id }).from(pets).where(eq(pets.userId, session.user.id));
  if (!myPet) return NextResponse.json({ error: "no_pet" }, { status: 400 });

  const since = new Date(Date.now() - LOOKBACK_HOURS * 3600 * 1000);
  const latDelta = (ERRAND_RADIUS_M / EARTH_RADIUS_M) * (180 / Math.PI);
  const lngDelta = latDelta / Math.max(Math.cos((latitude * Math.PI) / 180), 0.01);

  const mine = await effectiveInterests(session.user.id, session.user.interests ?? []);

  const rows = await db
    .select({
      id: posts.id,
      content: posts.content,
      createdAt: posts.createdAt,
      latitude: posts.latitude,
      longitude: posts.longitude,
      authoredByAgent: posts.authoredByAgent,
      moderationStatus: posts.moderationStatus,
      sensitiveCategories: posts.sensitiveCategories,
      petId: pets.id,
      petName: pets.name,
      species: pets.species,
      ownerName: users.name,
      ownerImage: users.image,
      likeCount: sql<number>`(select count(*) from ${likes} where ${likes.postId} = ${posts.id})`.mapWith(Number),
      commentCount: sql<number>`(select count(*) from ${comments} where ${comments.postId} = ${posts.id})`.mapWith(Number),
      // What makes the bundle feel hand-picked rather than "the latest four".
      overlap: sql<number>`(
        select count(*) from unnest(${users.interests}) i where i = any(${sql.param(mine)}::text[])
      )`.mapWith(Number),
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
        sql`${pets.id} <> ${myPet.id}`,
        amplifiedPosts(),
      ),
    )
    .orderBy(desc(sql`overlap`), desc(posts.createdAt))
    .limit(BUNDLE_SIZE);

  const [media, topics] = await Promise.all([
    mediaByPostId(rows.map((r) => r.id)),
    topicsByPostId(rows.map((r) => r.id)),
  ]);

  // The trip really happened, so it counts toward those relationships.
  await Promise.all(
    [...new Set(rows.map((r) => r.petId))].map((otherPetId) =>
      recordInteraction(myPet.id, otherPetId, "visit").catch(() => {}),
    ),
  );

  return NextResponse.json({
    posts: rows.map((r) => ({ ...r, media: media.get(r.id) ?? [], topics: topics.get(r.id) ?? [] })),
    // Empty is a real outcome: the pet went and there was nothing there.
    foundNothing: rows.length === 0,
    showSensitiveContent: session.user.showSensitiveContent,
  });
}

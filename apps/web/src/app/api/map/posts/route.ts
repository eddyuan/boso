import { NextResponse } from "next/server";
import { and, desc, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { comments, db, likes, pets, places, postTopics, posts, users } from "@bsocial/db";
import { mediaByPostId } from "@/lib/post-media";
import { requireSession } from "@/lib/session";
import { resolveAlias } from "@/lib/topics";
import { amplifiedPosts } from "@/lib/visibility";

const MAX_POSTS = 120;

const boundsSchema = z.object({
  west: z.coerce.number().min(-180).max(180),
  east: z.coerce.number().min(-180).max(180),
  south: z.coerce.number().min(-90).max(90),
  north: z.coerce.number().min(-90).max(90),
  /** Narrow the map to one topic, same slugs as the feed. */
  topic: z.string().trim().min(1).max(80).optional(),
});

// Posts with coordinates inside the visible map area, newest first.
// Each one is drawn on the map using its image (or its pet's species).
export async function GET(req: Request) {
  const { session, response } = await requireSession();
  if (response) return response;
  void session;

  const url = new URL(req.url);
  const parsed = boundsSchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "invalid_bounds" }, { status: 400 });
  const { west, east, south, north, topic } = parsed.data;
  const canonical = topic ? await resolveAlias(topic) : null;

  const rows = await db
    .select({
      id: posts.id,
      content: posts.content,
      latitude: posts.latitude,
      longitude: posts.longitude,
      createdAt: posts.createdAt,
      authoredByAgent: posts.authoredByAgent,
      moderationStatus: posts.moderationStatus,
      sensitiveCategories: posts.sensitiveCategories,
      likeCount: sql<number>`(select count(*) from ${likes} where ${likes.postId} = ${posts.id})`.mapWith(Number),
      commentCount: sql<number>`(select count(*) from ${comments} where ${comments.postId} = ${posts.id})`.mapWith(Number),
      petId: pets.id,
      petName: pets.name,
      species: pets.species,
      ownerName: users.name,
      ownerUsername: users.username,
      ownerImage: users.image,
      placeId: posts.placeId,
      placeName: places.name,
    })
    .from(posts)
    .innerJoin(pets, eq(pets.id, posts.petId))
    .innerJoin(users, eq(users.id, pets.userId))
    .leftJoin(places, eq(places.id, posts.placeId))
    .where(
      and(
        isNotNull(posts.latitude),
        isNotNull(posts.longitude),
        gte(posts.latitude, south),
        lte(posts.latitude, north),
        // Note: a map view crossing the antimeridian isn't handled yet.
        gte(posts.longitude, west),
        lte(posts.longitude, east),
        isNotNull(users.onboardingCompletedAt),
        amplifiedPosts(),
        canonical
          ? sql`exists (select 1 from ${postTopics} where ${postTopics.postId} = ${posts.id} and ${postTopics.topic} = ${canonical})`
          : undefined,
      ),
    )
    .orderBy(desc(posts.createdAt))
    .limit(MAX_POSTS);

  const media = await mediaByPostId(rows.map((r) => r.id));

  return NextResponse.json({
    posts: rows.map((r) => ({ ...r, media: media.get(r.id) ?? [] })),
  });
}

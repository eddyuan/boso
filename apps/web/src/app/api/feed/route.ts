import { NextResponse } from "next/server";
import { and, arrayOverlaps, desc, eq, inArray, isNotNull, lt, notInArray, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { comments, db, follows, likes, pets, postTopics, postViews, posts, users } from "@bsocial/db";
import { mediaByPostId } from "@/lib/post-media";
import { requireSession } from "@/lib/session";
import { recordLocation } from "@/lib/location";
import { effectiveInterests, resolveAlias, topicsByPostId } from "@/lib/topics";
import { amplifiedPosts, followedPosts, ownOrVisible } from "@/lib/visibility";

const PAGE_SIZE = 20;
/** Tielo is a local app: the feed reaches as far as the pet does. */
export const FEED_RADIUS_M = 5_000;
const EARTH_RADIUS_M = 6_371_000;

const querySchema = z.object({
  scope: z.enum(["nearby", "following", "discover"]).default("nearby"),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  before: z.string().datetime().optional(),
  /** Narrow to one topic. Aliases resolve server-side so a stale slug still works. */
  topic: z.string().trim().min(1).max(80).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(PAGE_SIZE),
});

/**
 * Feed, in three scopes:
 *  - nearby    posts within 5 km of you, whoever wrote them (the default —
 *              this is a map-first app, so proximity comes before the graph)
 *  - following posts from the pets your pet follows, plus your own
 *  - discover  nearby posts by people you don't follow who share an interest
 *
 * Every post carries `distanceM` when the caller sends coordinates, so the apps
 * can label it ("320 m").
 */
export async function GET(req: Request) {
  const { session, response } = await requireSession();
  if (response) return response;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  const { scope, latitude, longitude, before, limit, topic } = parsed.data;

  const [myPet] = await db.select({ id: pets.id }).from(pets).where(eq(pets.userId, session.user.id));
  if (!myPet) return NextResponse.json({ posts: [], nextCursor: null });

  const located = latitude !== undefined && longitude !== undefined;
  // Every authenticated request that already carries a position updates it, so
  // the apps never have to report location separately (lib/location.ts).
  if (located) await recordLocation(session.user.id, latitude!, longitude!);
  if ((scope === "nearby" || scope === "discover") && !located) {
    return NextResponse.json({ error: "location_required" }, { status: 400 });
  }

  // Great-circle distance in metres, or null when the caller has no fix.
  const distance = located
    ? sql<number>`(
        ${EARTH_RADIUS_M} * acos(least(1, greatest(-1,
          cos(radians(${latitude})) * cos(radians(${posts.latitude})) *
          cos(radians(${posts.longitude}) - radians(${longitude})) +
          sin(radians(${latitude})) * sin(radians(${posts.latitude}))
        )))
      )`.mapWith(Number)
    : sql<number | null>`null`;

  const filters: (SQL | undefined)[] = [
    before ? lt(posts.createdAt, new Date(before)) : undefined,
    // Following is the one surface that may show `restricted` posts, since the
    // reader already chose to follow the author (lib/visibility.ts).
    ownOrVisible(myPet.id, scope === "following" ? followedPosts() : amplifiedPosts()),
  ];

  if (scope === "following") {
    const following = await db
      .select({ id: follows.followingPetId })
      .from(follows)
      .where(eq(follows.followerPetId, myPet.id));
    filters.push(inArray(posts.petId, [myPet.id, ...following.map((f) => f.id)]));
  } else {
    // Bounding box first so the index does the work, then the exact radius.
    const latDelta = (FEED_RADIUS_M / EARTH_RADIUS_M) * (180 / Math.PI);
    const lngDelta = latDelta / Math.max(Math.cos((latitude! * Math.PI) / 180), 0.01);
    filters.push(
      isNotNull(posts.latitude),
      isNotNull(posts.longitude),
      sql`${posts.latitude} between ${latitude! - latDelta} and ${latitude! + latDelta}`,
      sql`${posts.longitude} between ${longitude! - lngDelta} and ${longitude! + lngDelta}`,
      sql`${distance} <= ${FEED_RADIUS_M}`,
    );

    if (scope === "discover") {
      // People your pet hasn't followed yet who share at least one interest.
      const following = await db
        .select({ id: follows.followingPetId })
        .from(follows)
        .where(eq(follows.followerPetId, myPet.id));
      const seen = [myPet.id, ...following.map((f) => f.id)];
      filters.push(notInArray(posts.petId, seen));
      // Declared interests ∪ the ones behind what they actually post about,
      // so Discover follows real behaviour and still works on day one.
      const mine = await effectiveInterests(session.user.id, session.user.interests ?? []);
      if (mine.length > 0) filters.push(arrayOverlaps(users.interests, mine));
    }
  }

  if (topic) {
    // Resolved through the alias chain, so a slug saved before an admin merged
    // two topics still returns the posts it used to.
    const canonical = await resolveAlias(topic);
    filters.push(
      sql`exists (select 1 from ${postTopics} where ${postTopics.postId} = ${posts.id} and ${postTopics.topic} = ${canonical})`,
    );
  }

  const rows = await db
    .select({
      id: posts.id,
      content: posts.content,
      createdAt: posts.createdAt,
      authoredByAgent: posts.authoredByAgent,
      moderationStatus: posts.moderationStatus,
      sensitiveCategories: posts.sensitiveCategories,
      latitude: posts.latitude,
      longitude: posts.longitude,
      distanceM: distance,
      petId: pets.id,
      petName: pets.name,
      species: pets.species,
      petAvatar: pets.avatarUrl,
      ownerName: users.name,
      ownerUsername: users.username,
      ownerImage: users.image,
      likeCount: sql<number>`(select count(*) from ${likes} where ${likes.postId} = ${posts.id})`.mapWith(Number),
      likedByMe: sql<boolean>`exists (select 1 from ${likes} where ${likes.postId} = ${posts.id} and ${likes.petId} = ${myPet.id})`,
      commentCount: sql<number>`(select count(*) from ${comments} where ${comments.postId} = ${posts.id})`.mapWith(Number),
      /** Your own posts come through the feed too; only you get to see who looked. */
      mine: sql<boolean>`${posts.petId} = ${myPet.id}`,
      viewCount: sql<number>`(select count(*) from ${postViews} where ${postViews.postId} = ${posts.id})`.mapWith(Number),
    })
    .from(posts)
    .innerJoin(pets, eq(pets.id, posts.petId))
    .innerJoin(users, eq(users.id, pets.userId))
    .where(and(...filters))
    .orderBy(desc(posts.createdAt))
    .limit(limit);

  const media = await mediaByPostId(rows.map((r) => r.id));

  const topics = await topicsByPostId(rows.map((r) => r.id));

  return NextResponse.json({
    posts: rows.map((r) => ({ ...r, media: media.get(r.id) ?? [], topics: topics.get(r.id) ?? [] })),
    // The client needs this to decide whether a `sensitive` post gets a cover.
    showSensitiveContent: session.user.showSensitiveContent,
    nextCursor: rows.length === limit ? rows[rows.length - 1]!.createdAt.toISOString() : null,
  });
}

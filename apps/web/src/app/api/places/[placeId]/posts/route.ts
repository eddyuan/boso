import { NextResponse } from "next/server";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { comments, db, likes, pets, places, posts, users } from "@bsocial/db";
import { photosByPlaceId } from "@/lib/place-photos";
import { mediaByPostId } from "@/lib/post-media";
import { requireSession } from "@/lib/session";
import { amplifiedPosts, ownOrVisible } from "@/lib/visibility";

/**
 * What's being said at one place right now.
 *
 * Deliberately ephemeral: a window rather than an archive. A park's thread is
 * only interesting because it's what's happening there today — kept forever it
 * becomes a dead guestbook, and the first thing anyone reads at a busy place
 * would be a year-old post.
 *
 * Visibility is the same rule as everywhere else, so a place thread can't become
 * a way to read posts the feed would have hidden.
 */

const WINDOW_HOURS = 48;

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

export async function GET(req: Request, { params }: { params: Promise<{ placeId: string }> }) {
  const { session, response } = await requireSession();
  if (response) return response;

  const { placeId } = await params;
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "invalid_query" }, { status: 400 });

  const [place] = await db
    .select({
      id: places.id,
      name: places.name,
      address: places.address,
      category: places.category,
      latitude: places.latitude,
      longitude: places.longitude,
      isHotspot: places.isHotspot,
    })
    .from(places)
    .where(eq(places.id, placeId));
  if (!place) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const placePhotos = (await photosByPlaceId([place.id])).get(place.id) ?? [];

  const [myPet] = await db.select({ id: pets.id }).from(pets).where(eq(pets.userId, session.user.id));
  if (!myPet) return NextResponse.json({ place, photos: placePhotos, posts: [] });

  const since = new Date(Date.now() - WINDOW_HOURS * 3600 * 1000);

  const rows = await db
    .select({
      id: posts.id,
      content: posts.content,
      createdAt: posts.createdAt,
      authoredByAgent: posts.authoredByAgent,
      moderationStatus: posts.moderationStatus,
      sensitiveCategories: posts.sensitiveCategories,
      petName: pets.name,
      species: pets.species,
      ownerName: users.name,
      ownerUsername: users.username,
      ownerImage: users.image,
      likeCount: sql<number>`(select count(*) from ${likes} where ${likes.postId} = ${posts.id})`.mapWith(Number),
      likedByMe: sql<boolean>`exists (select 1 from ${likes} where ${likes.postId} = ${posts.id} and ${likes.petId} = ${myPet.id})`,
      commentCount: sql<number>`(select count(*) from ${comments} where ${comments.postId} = ${posts.id})`.mapWith(Number),
    })
    .from(posts)
    .innerJoin(pets, eq(pets.id, posts.petId))
    .innerJoin(users, eq(users.id, pets.userId))
    .where(and(eq(posts.placeId, placeId), gt(posts.createdAt, since), ownOrVisible(myPet.id, amplifiedPosts())))
    .orderBy(desc(posts.createdAt))
    .limit(parsed.data.limit);

  const media = await mediaByPostId(rows.map((r) => r.id));

  return NextResponse.json({
    place,
    photos: placePhotos,
    windowHours: WINDOW_HOURS,
    posts: rows.map((r) => ({ ...r, media: media.get(r.id) ?? [] })),
    showSensitiveContent: session.user.showSensitiveContent,
  });
}

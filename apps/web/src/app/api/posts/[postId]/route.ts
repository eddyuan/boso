import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { comments, db, likes, pets, places, postViews, posts, users } from "@bsocial/db";
import { mediaByPostId } from "@/lib/post-media";
import { requireSession } from "@/lib/session";
import { amplifiedPosts, ownOrVisible } from "@/lib/visibility";

/**
 * One post, for the thread screen.
 *
 * A thread has to be reachable by id — from a notification, a whisper's source, a
 * shared link — so it can't rely on the caller already holding the post. The
 * feed's copy is a convenience, not the source.
 *
 * Visibility is the feed's rule, so opening a link can't reveal something the
 * feed would have hidden; a post that fails it reads as missing rather than
 * forbidden, since "you may not see this" is itself information.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ postId: string }> }) {
  const { session, response } = await requireSession();
  if (response) return response;

  const { postId } = await params;
  const [myPet] = await db.select({ id: pets.id }).from(pets).where(eq(pets.userId, session.user.id));
  if (!myPet) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const [post] = await db
    .select({
      id: posts.id,
      content: posts.content,
      createdAt: posts.createdAt,
      authoredByAgent: posts.authoredByAgent,
      moderationStatus: posts.moderationStatus,
      sensitiveCategories: posts.sensitiveCategories,
      latitude: posts.latitude,
      longitude: posts.longitude,
      placeId: posts.placeId,
      placeName: places.name,
      petId: pets.id,
      petName: pets.name,
      species: pets.species,
      ownerName: users.name,
      ownerUsername: users.username,
      ownerImage: users.image,
      likeCount: sql<number>`(select count(*) from ${likes} where ${likes.postId} = ${posts.id})`.mapWith(Number),
      likedByMe: sql<boolean>`exists (select 1 from ${likes} where ${likes.postId} = ${posts.id} and ${likes.petId} = ${myPet.id})`,
      commentCount: sql<number>`(select count(*) from ${comments} where ${comments.postId} = ${posts.id})`.mapWith(Number),
      mine: sql<boolean>`${posts.petId} = ${myPet.id}`,
      viewCount: sql<number>`(select count(*) from ${postViews} where ${postViews.postId} = ${posts.id})`.mapWith(Number),
    })
    .from(posts)
    .innerJoin(pets, eq(pets.id, posts.petId))
    .innerJoin(users, eq(users.id, pets.userId))
    .leftJoin(places, eq(places.id, posts.placeId))
    .where(and(eq(posts.id, postId), ownOrVisible(myPet.id, amplifiedPosts())));

  if (!post) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const media = await mediaByPostId([post.id]);
  return NextResponse.json({
    post: { ...post, media: media.get(post.id) ?? [] },
    showSensitiveContent: session.user.showSensitiveContent,
  });
}

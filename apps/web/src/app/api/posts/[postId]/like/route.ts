import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db, likes, pets, posts } from "@bsocial/db";
import { requireSession } from "@/lib/session";

/**
 * Liking is done *by your pet*, not by you — the whole social graph in Tielo is
 * pet-to-pet, and a like from Kiwi reads better than one from an account name.
 */
async function resolve(postId: string, userId: string) {
  const [myPet] = await db.select({ id: pets.id }).from(pets).where(eq(pets.userId, userId));
  if (!myPet) return { error: NextResponse.json({ error: "no_pet" }, { status: 400 }) };

  const [post] = await db
    .select({ id: posts.id, status: posts.moderationStatus, hiddenAt: posts.hiddenAt })
    .from(posts)
    .where(eq(posts.id, postId));
  if (!post) return { error: NextResponse.json({ error: "not_found" }, { status: 404 }) };

  // Nothing that a reader shouldn't be seeing can be reacted to either.
  if (post.hiddenAt || post.status === "blocked" || post.status === "pending_review") {
    return { error: NextResponse.json({ error: "unavailable" }, { status: 403 }) };
  }
  return { petId: myPet.id };
}

const countFor = async (postId: string) => {
  const [row] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(likes)
    .where(eq(likes.postId, postId));
  return row?.count ?? 0;
};

export async function POST(_req: Request, { params }: { params: Promise<{ postId: string }> }) {
  const { session, response } = await requireSession();
  if (response) return response;

  const { postId } = await params;
  const resolved = await resolve(postId, session.user.id);
  if (resolved.error) return resolved.error;

  // Unique on (petId, postId), so a double-tap is a no-op rather than an error.
  await db.insert(likes).values({ petId: resolved.petId, postId }).onConflictDoNothing();
  return NextResponse.json({ liked: true, likeCount: await countFor(postId) });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ postId: string }> }) {
  const { session, response } = await requireSession();
  if (response) return response;

  const { postId } = await params;
  const [myPet] = await db.select({ id: pets.id }).from(pets).where(eq(pets.userId, session.user.id));
  if (!myPet) return NextResponse.json({ error: "no_pet" }, { status: 400 });

  await db.delete(likes).where(and(eq(likes.postId, postId), eq(likes.petId, myPet.id)));
  return NextResponse.json({ liked: false, likeCount: await countFor(postId) });
}

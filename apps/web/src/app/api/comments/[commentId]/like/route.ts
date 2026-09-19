import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { commentLikes, comments, db, pets } from "@bsocial/db";
import { requireSession } from "@/lib/session";

/** Liking a reply, by your pet — same shape as liking a post. */

const countFor = async (commentId: string) => {
  const [row] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(commentLikes)
    .where(eq(commentLikes.commentId, commentId));
  return row?.count ?? 0;
};

async function myPetId(userId: string) {
  const [pet] = await db.select({ id: pets.id }).from(pets).where(eq(pets.userId, userId));
  return pet?.id ?? null;
}

export async function POST(_req: Request, { params }: { params: Promise<{ commentId: string }> }) {
  const { session, response } = await requireSession();
  if (response) return response;

  const { commentId } = await params;
  const petId = await myPetId(session.user.id);
  if (!petId) return NextResponse.json({ error: "no_pet" }, { status: 400 });

  const [comment] = await db.select({ id: comments.id }).from(comments).where(eq(comments.id, commentId));
  if (!comment) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await db.insert(commentLikes).values({ petId, commentId }).onConflictDoNothing();
  return NextResponse.json({ liked: true, likeCount: await countFor(commentId) });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ commentId: string }> }) {
  const { session, response } = await requireSession();
  if (response) return response;

  const { commentId } = await params;
  const petId = await myPetId(session.user.id);
  if (!petId) return NextResponse.json({ error: "no_pet" }, { status: 400 });

  await db.delete(commentLikes).where(and(eq(commentLikes.commentId, commentId), eq(commentLikes.petId, petId)));
  return NextResponse.json({ liked: false, likeCount: await countFor(commentId) });
}

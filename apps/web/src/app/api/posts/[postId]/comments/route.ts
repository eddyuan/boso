import { NextResponse } from "next/server";
import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { commentLikes, comments, db, pets, posts, users } from "@bsocial/db";
import { MAX_POST_MEDIA } from "@/lib/post-media";
import { awardXpQuietly } from "@/lib/bond";
import { requireSession } from "@/lib/session";

const MAX_LENGTH = 500;

/**
 * Replies to a post. Threading is flat and one level deep (Tieba/Instagram
 * style): `parentId` always points at the *top-level* comment of a thread,
 * never at another reply, so a thread can't nest arbitrarily. Replying to a
 * reply attaches to the same thread and records `replyToPetId`, which is what
 * renders the "@Name" prefix.
 */

export async function GET(_req: Request, { params }: { params: Promise<{ postId: string }> }) {
  const { session, response } = await requireSession();
  if (response) return response;

  const { postId } = await params;
  const [myPet] = await db.select({ id: pets.id }).from(pets).where(eq(pets.userId, session.user.id));

  const replyTo = sql`reply_to_pet`;
  const rows = await db
    .select({
      id: comments.id,
      parentId: comments.parentId,
      content: comments.content,
      authoredByAgent: comments.authoredByAgent,
      createdAt: comments.createdAt,
      petId: pets.id,
      petName: pets.name,
      species: pets.species,
      petAvatar: pets.avatarUrl,
      ownerName: users.name,
      ownerUsername: users.username,
      ownerImage: users.image,
      replyToName: sql<string | null>`${replyTo}.name`,
      likeCount: sql<number>`(select count(*) from ${commentLikes} where ${commentLikes.commentId} = ${comments.id})`.mapWith(Number),
      likedByMe: myPet
        ? sql<boolean>`exists (select 1 from ${commentLikes} where ${commentLikes.commentId} = ${comments.id} and ${commentLikes.petId} = ${myPet.id})`
        : sql<boolean>`false`,
    })
    .from(comments)
    .innerJoin(pets, eq(pets.id, comments.petId))
    .innerJoin(users, eq(users.id, pets.userId))
    .leftJoin(sql`${pets} as reply_to_pet`, sql`${comments.replyToPetId} = ${replyTo}.id`)
    .where(eq(comments.postId, postId))
    .orderBy(asc(comments.createdAt));

  // Grouped for the client: top-level comments, each with its flat reply list.
  const tops = rows.filter((r) => r.parentId === null);
  const repliesByParent = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!r.parentId) continue;
    const list = repliesByParent.get(r.parentId) ?? [];
    list.push(r);
    repliesByParent.set(r.parentId, list);
  }

  return NextResponse.json({
    comments: tops.map((c) => ({ ...c, replies: repliesByParent.get(c.id) ?? [] })),
    total: rows.length,
  });
}

const bodySchema = z.object({
  content: z.string().trim().min(1).max(MAX_LENGTH),
  /** The thread to reply into. Omit for a new top-level comment. */
  parentId: z.string().uuid().optional(),
  /** Who this reply addresses, for the "@Name" prefix. */
  replyToPetId: z.string().uuid().optional(),
  media: z
    .array(
      z.object({
        url: z.string().url().max(2048),
        thumbUrl: z.string().url().max(2048).optional(),
        kind: z.enum(["image", "video"]).default("image"),
      }),
    )
    .max(MAX_POST_MEDIA)
    .default([]),
});

export async function POST(req: Request, { params }: { params: Promise<{ postId: string }> }) {
  const { session, response } = await requireSession();
  if (response) return response;

  const { postId } = await params;

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { content, parentId, replyToPetId, media } = parsed.data;

  const [myPet] = await db.select({ id: pets.id }).from(pets).where(eq(pets.userId, session.user.id));
  if (!myPet) return NextResponse.json({ error: "no_pet" }, { status: 400 });

  const [post] = await db
    .select({ id: posts.id, status: posts.moderationStatus, hiddenAt: posts.hiddenAt })
    .from(posts)
    .where(eq(posts.id, postId));
  if (!post) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (post.hiddenAt || post.status === "blocked" || post.status === "pending_review") {
    return NextResponse.json({ error: "unavailable" }, { status: 403 });
  }

  // Normalise the thread root: replying to a reply joins that reply's thread
  // rather than nesting under it, which is what keeps threading one level deep.
  let root: string | null = null;
  if (parentId) {
    const [parent] = await db
      .select({ id: comments.id, parentId: comments.parentId, postId: comments.postId })
      .from(comments)
      .where(eq(comments.id, parentId));
    if (!parent || parent.postId !== postId) {
      return NextResponse.json({ error: "unknown_parent" }, { status: 400 });
    }
    root = parent.parentId ?? parent.id;
  }

  const [comment] = await db
    .insert(comments)
    .values({
      postId,
      petId: myPet.id,
      parentId: root,
      replyToPetId: replyToPetId ?? null,
      content,
      authoredByAgent: false,
    })
    .returning();

  if (media.length > 0) {
    const { attachCommentMedia } = await import("@/lib/post-media");
    await attachCommentMedia(comment!.id, media);
  }

  awardXpQuietly(myPet.id, "wrote_reply");

  return NextResponse.json({ comment }, { status: 201 });
}

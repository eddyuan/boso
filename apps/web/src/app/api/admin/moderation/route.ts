import { NextResponse } from "next/server";
import { z } from "zod";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { db, pets, postMedia, posts, users } from "@bsocial/db";
import { SENSITIVE_CATEGORY_VALUES } from "@bsocial/shared";
import { mediaByPostId } from "@/lib/post-media";
import { requireSession } from "@/lib/session";

const PAGE_SIZE = 25;

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  status: z.enum(["pending_review", "sensitive", "restricted", "blocked", "pending"]).default("pending_review"),
});

/** The review queue: what the classifier wasn't willing to decide alone. */
export async function GET(req: Request) {
  const { session, response } = await requireSession({ requireAdmin: true });
  if (response) return response;
  void session;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "invalid_query" }, { status: 400 });

  const { page, status } = parsed.data;
  const offset = (page - 1) * PAGE_SIZE;

  const [rows, totalRow, counts] = await Promise.all([
    db
      .select({
        id: posts.id,
        content: posts.content,
        moderationStatus: posts.moderationStatus,
        moderationScores: posts.moderationScores,
        sensitiveCategories: posts.sensitiveCategories,
        moderatedAt: posts.moderatedAt,
        moderationModel: posts.moderationModel,
        reviewedAt: posts.reviewedAt,
        reviewNote: posts.reviewNote,
        createdAt: posts.createdAt,
        authoredByAgent: posts.authoredByAgent,
        petName: pets.name,
        ownerId: users.id,
        ownerName: users.name,
        ownerIsMock: users.isMock,
      })
      .from(posts)
      .innerJoin(pets, eq(pets.id, posts.petId))
      .innerJoin(users, eq(users.id, pets.userId))
      .where(eq(posts.moderationStatus, status))
      .orderBy(desc(posts.moderatedAt))
      .limit(PAGE_SIZE)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(posts)
      .where(eq(posts.moderationStatus, status)),
    db
      .select({ status: posts.moderationStatus, count: sql<number>`count(*)`.mapWith(Number) })
      .from(posts)
      .groupBy(posts.moderationStatus),
  ]);

  const media = await mediaByPostId(rows.map((r) => r.id));

  return NextResponse.json({
    posts: rows.map((r) => ({ ...r, media: media.get(r.id) ?? [] })),
    total: totalRow[0]?.count ?? 0,
    counts: Object.fromEntries(counts.map((c) => [c.status, c.count])),
    categories: SENSITIVE_CATEGORY_VALUES,
    page,
    pageSize: PAGE_SIZE,
  });
}

const decisionSchema = z.object({
  id: z.string().uuid(),
  /** Mirrors the ladder in @bsocial/shared/moderation. */
  decision: z.enum(["approve", "sensitive", "restrict", "block"]),
  categories: z.array(z.enum(SENSITIVE_CATEGORY_VALUES as [string, ...string[]])).optional(),
  note: z.string().max(500).optional(),
});

const STATUS_FOR = {
  approve: "approved",
  sensitive: "sensitive",
  restrict: "restricted",
  block: "blocked",
} as const;

/**
 * A human's call, which always beats the model's. The original scores stay on
 * the row so a later threshold change can be judged against real decisions.
 */
export async function PATCH(req: Request) {
  const { session, response } = await requireSession({ requireAdmin: true });
  if (response) return response;

  const body = await req.json().catch(() => null);
  const parsed = decisionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const { id, decision, categories, note } = parsed.data;
  const status = STATUS_FOR[decision];

  const [updated] = await db
    .update(posts)
    .set({
      moderationStatus: status,
      // Approving clears the labels; anything else keeps (or replaces) them so
      // the blur cover can say which category it's covering for.
      sensitiveCategories: decision === "approve" ? [] : (categories ?? undefined),
      reviewedBy: session.user.id,
      reviewedAt: new Date(),
      reviewNote: note ?? null,
    })
    .where(eq(posts.id, id))
    .returning({ id: posts.id, moderationStatus: posts.moderationStatus });

  if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // An approved post shouldn't keep blurred photos behind it.
  if (decision === "approve") {
    await db.update(postMedia).set({ blurred: false }).where(eq(postMedia.postId, id));
  }

  return NextResponse.json({ post: updated });
}

/** Re-queue a batch for classification, e.g. after a threshold change. */
export async function POST(req: Request) {
  const { session, response } = await requireSession({ requireAdmin: true });
  if (response) return response;
  void session;

  const body = await req.json().catch(() => null);
  const parsed = z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const { inngest } = await import("@/inngest/client");
  await db.update(posts).set({ moderationStatus: "pending" }).where(inArray(posts.id, parsed.data.ids));
  await Promise.all(
    parsed.data.ids.map((postId) => inngest.send({ name: "post/created", data: { postId } })),
  );

  return NextResponse.json({ requeued: parsed.data.ids.length });
}

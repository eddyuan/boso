import { NextResponse } from "next/server";
import { z } from "zod";
import { desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db, pets, places, posts, users } from "@bsocial/db";
import { mediaByPostId } from "@/lib/post-media";
import { requireSession } from "@/lib/session";

const PAGE_SIZE = 30;

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  hasImage: z.enum(["all", "yes", "no"]).default("all"),
  agentOnly: z.enum(["all", "yes", "no"]).default("all"),
  visibility: z.enum(["all", "visible", "hidden"]).default("all"),
});

export async function GET(req: Request) {
  const { session, response } = await requireSession({ requireAdmin: true });
  if (response) return response;
  void session;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "invalid_query" }, { status: 400 });

  const { page, hasImage, agentOnly, visibility } = parsed.data;
  const offset = (page - 1) * PAGE_SIZE;

  const conditions = [];
  if (hasImage === "yes") conditions.push(sql`exists (select 1 from post_media where post_media.post_id = ${posts.id})`);
  if (hasImage === "no") conditions.push(sql`not exists (select 1 from post_media where post_media.post_id = ${posts.id})`);
  if (agentOnly === "yes") conditions.push(eq(posts.authoredByAgent, true));
  if (agentOnly === "no") conditions.push(eq(posts.authoredByAgent, false));
  if (visibility === "visible") conditions.push(isNull(posts.hiddenAt));
  if (visibility === "hidden") conditions.push(isNotNull(posts.hiddenAt));

  const where = conditions.length ? sql.join(conditions, sql` and `) : sql`true`;

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: posts.id,
        content: posts.content,
        latitude: posts.latitude,
        longitude: posts.longitude,
        authoredByAgent: posts.authoredByAgent,
        hiddenAt: posts.hiddenAt,
        createdAt: posts.createdAt,
        petName: pets.name,
        petSpecies: pets.species,
        ownerName: users.name,
        ownerUsername: users.username,
        placeName: places.name,
      })
      .from(posts)
      .innerJoin(pets, eq(pets.id, posts.petId))
      .innerJoin(users, eq(users.id, pets.userId))
      .leftJoin(places, eq(places.id, posts.placeId))
      .where(where)
      .orderBy(desc(posts.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(posts)
      .where(where),
  ]);

  const media = await mediaByPostId(rows.map((r) => r.id));

  return NextResponse.json({
    posts: rows.map((r) => ({ ...r, media: media.get(r.id) ?? [] })),
    total: totalRow[0]?.count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  });
}

const patchSchema = z.object({
  id: z.string().uuid(),
  hidden: z.boolean(),
});

/** Hide or unhide a post. Hidden posts stay in the table but leave every feed. */
export async function PATCH(req: Request) {
  const { session, response } = await requireSession({ requireAdmin: true });
  if (response) return response;
  void session;

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const { id, hidden } = parsed.data;
  const [updated] = await db
    .update(posts)
    .set({ hiddenAt: hidden ? new Date() : null })
    .where(eq(posts.id, id))
    .returning({ id: posts.id, hiddenAt: posts.hiddenAt });

  if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ post: updated });
}

/** Permanent delete. Media, likes, comments and views cascade with the row. */
export async function DELETE(req: Request) {
  const { session, response } = await requireSession({ requireAdmin: true });
  if (response) return response;
  void session;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const [deleted] = await db.delete(posts).where(eq(posts.id, id)).returning({ id: posts.id });
  if (!deleted) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

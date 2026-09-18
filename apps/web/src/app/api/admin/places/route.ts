import { NextResponse } from "next/server";
import { z } from "zod";
import { desc, sql } from "drizzle-orm";
import { db, places, posts } from "@bsocial/db";
import { requireSession } from "@/lib/session";

const PAGE_SIZE = 30;

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().optional(),
});

export async function GET(req: Request) {
  const { session, response } = await requireSession({ requireAdmin: true });
  if (response) return response;
  void session;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "invalid_query" }, { status: 400 });

  const { page, search } = parsed.data;
  const offset = (page - 1) * PAGE_SIZE;

  const conditions = [];
  if (search) {
    const q = `%${search}%`;
    conditions.push(sql`(${places.name} ilike ${q} or ${places.address} ilike ${q} or ${places.category} ilike ${q})`);
  }

  const where = conditions.length ? sql.join(conditions, sql` and `) : sql`true`;

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: places.id,
        name: places.name,
        category: places.category,
        address: places.address,
        latitude: places.latitude,
        longitude: places.longitude,
        source: places.source,
        createdAt: places.createdAt,
        postCount: sql<number>`(select count(*) from ${posts} where ${posts.placeId} = ${places.id})`.mapWith(Number),
      })
      .from(places)
      .where(where)
      .orderBy(desc(places.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(places)
      .where(where),
  ]);

  return NextResponse.json({
    places: rows,
    total: totalRow[0]?.count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  });
}

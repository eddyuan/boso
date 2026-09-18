import { NextResponse } from "next/server";
import { and, ilike, sql } from "drizzle-orm";
import { z } from "zod";
import { db, places } from "@bsocial/db";
import { requireSession } from "@/lib/session";

const LIMIT = 20;
const EARTH_RADIUS_M = 6_371_000;
/** Places are only useful if you could plausibly be there. */
const SEARCH_RADIUS_M = 20_000;

const querySchema = z.object({
  q: z.string().trim().max(80).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
});

/**
 * Places to attach a post to: what's closest when the picker opens, then
 * name matches as you type.
 */
export async function GET(req: Request) {
  const { response } = await requireSession();
  if (response) return response;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  const { q, latitude, longitude } = parsed.data;

  const located = latitude !== undefined && longitude !== undefined;
  if (!located && !q) return NextResponse.json({ places: [] });

  const distance = located
    ? sql<number>`(
        ${EARTH_RADIUS_M} * acos(least(1, greatest(-1,
          cos(radians(${latitude})) * cos(radians(${places.latitude})) *
          cos(radians(${places.longitude}) - radians(${longitude})) +
          sin(radians(${latitude})) * sin(radians(${places.latitude}))
        )))
      )`.mapWith(Number)
    : sql<number | null>`null`;

  const filters = [
    q ? ilike(places.name, `%${q}%`) : undefined,
    located ? sql`${distance} <= ${SEARCH_RADIUS_M}` : undefined,
  ].filter(Boolean);

  const rows = await db
    .select({
      id: places.id,
      name: places.name,
      category: places.category,
      latitude: places.latitude,
      longitude: places.longitude,
      address: places.address,
      distanceM: distance,
    })
    .from(places)
    .where(filters.length ? and(...filters) : undefined)
    // Nearest first when we know where you are, alphabetical otherwise.
    .orderBy(located ? sql`${distance}` : places.name)
    .limit(LIMIT);

  return NextResponse.json({ places: rows });
}

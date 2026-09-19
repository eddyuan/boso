import { NextResponse } from "next/server";
import { and, asc, desc, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { db, places, posts } from "@bsocial/db";
import { requireSession } from "@/lib/session";

/**
 * Venues in the visible map area.
 *
 * This is the answer to an empty map. A new user in an unseeded neighbourhood
 * has no posts around them, and a blank map reads as a broken app rather than a
 * quiet one — but places exist everywhere Google Places does, so there is always
 * something real to show. Unlike widening the post radius, nothing here is a
 * compromise on "local" or on honesty: a café is a café, with no caveat about
 * who wrote it.
 *
 * Each one is a thread waiting to happen, which is what turns the empty state
 * into an invitation: tap a venue, see nothing has been said there, post first.
 */

const MAX_PLACES = 40;

const boundsSchema = z.object({
  west: z.coerce.number().min(-180).max(180),
  east: z.coerce.number().min(-180).max(180),
  south: z.coerce.number().min(-90).max(90),
  north: z.coerce.number().min(-90).max(90),
});

export async function GET(req: Request) {
  const { response } = await requireSession();
  if (response) return response;

  const parsed = boundsSchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "invalid_bounds" }, { status: 400 });
  const { west, east, south, north } = parsed.data;

  const rows = await db
    .select({
      id: places.id,
      name: places.name,
      category: places.category,
      latitude: places.latitude,
      longitude: places.longitude,
      isHotspot: places.isHotspot,
      postCount: sql<number>`(select count(*) from ${posts} where ${posts.placeId} = ${places.id})`.mapWith(Number),
    })
    .from(places)
    .where(
      and(
        gte(places.latitude, south),
        lte(places.latitude, north),
        // Note: a view crossing the antimeridian isn't handled, same as map/posts.
        gte(places.longitude, west),
        lte(places.longitude, east),
      ),
    )
    // Gathering spots first, then anywhere that has ever been posted about. The
    // final sort is on id rather than random(): a random order would reshuffle
    // which venues survive the cap on every pan, so pins would flicker in and
    // out as the user moves the map.
    .orderBy(
      desc(places.isHotspot),
      desc(sql`(select count(*) from ${posts} where ${posts.placeId} = ${places.id})`),
      asc(places.id),
    )
    .limit(MAX_PLACES);

  return NextResponse.json({ places: rows });
}

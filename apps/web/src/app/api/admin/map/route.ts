import { NextResponse } from "next/server";
import { and, desc, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { z } from "zod";
import { db, mockProfiles, pets, places, posts, users } from "@bsocial/db";
import { requireSession } from "@/lib/session";

/**
 * Coverage view: where the map actually has content, so seeding can be aimed
 * instead of guessed. Unlike /api/map/posts this includes hidden posts (badged)
 * and the strays' home coordinates, because the question here is "what is out
 * there", not "what would a user see".
 */
const MAX_POSTS = 500;
const MAX_PLACES = 500;

const boundsSchema = z.object({
  west: z.coerce.number().min(-180).max(180),
  east: z.coerce.number().min(-180).max(180),
  south: z.coerce.number().min(-90).max(90),
  north: z.coerce.number().min(-90).max(90),
});

export async function GET(req: Request) {
  const { session, response } = await requireSession({ requireAdmin: true });
  if (response) return response;
  void session;

  const url = new URL(req.url);
  const parsed = boundsSchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "invalid_bounds" }, { status: 400 });

  const { west, east, south, north } = parsed.data;
  const inBounds = (lat: AnyPgColumn, lng: AnyPgColumn) =>
    and(isNotNull(lat), isNotNull(lng), gte(lat, south), lte(lat, north), gte(lng, west), lte(lng, east));

  const [postRows, placeRows, strayRows, totals] = await Promise.all([
    db
      .select({
        id: posts.id,
        latitude: posts.latitude,
        longitude: posts.longitude,
        content: posts.content,
        authoredByAgent: posts.authoredByAgent,
        hiddenAt: posts.hiddenAt,
        createdAt: posts.createdAt,
        petName: pets.name,
        ownerIsMock: users.isMock,
      })
      .from(posts)
      .innerJoin(pets, eq(pets.id, posts.petId))
      .innerJoin(users, eq(users.id, pets.userId))
      .where(inBounds(posts.latitude, posts.longitude))
      .orderBy(desc(posts.createdAt))
      .limit(MAX_POSTS),
    db
      .select({
        id: places.id,
        name: places.name,
        latitude: places.latitude,
        longitude: places.longitude,
        category: places.category,
      })
      .from(places)
      .where(inBounds(places.latitude, places.longitude))
      .limit(MAX_PLACES),
    db
      .select({
        userId: mockProfiles.userId,
        name: users.name,
        location: mockProfiles.location,
        latitude: mockProfiles.latitude,
        longitude: mockProfiles.longitude,
        petName: pets.name,
      })
      .from(mockProfiles)
      .innerJoin(users, eq(users.id, mockProfiles.userId))
      .leftJoin(pets, eq(pets.userId, mockProfiles.userId))
      .where(inBounds(mockProfiles.latitude, mockProfiles.longitude)),
    db
      .select({
        posts: sql<number>`count(*) filter (where ${posts.latitude} is not null)`.mapWith(Number),
        hidden: sql<number>`count(*) filter (where ${posts.hiddenAt} is not null)`.mapWith(Number),
        byAgents: sql<number>`count(*) filter (where ${posts.authoredByAgent} = true)`.mapWith(Number),
      })
      .from(posts),
  ]);

  return NextResponse.json({
    posts: postRows,
    places: placeRows,
    strays: strayRows,
    totals: totals[0] ?? { posts: 0, hidden: 0, byAgents: 0 },
  });
}

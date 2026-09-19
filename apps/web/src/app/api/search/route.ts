import { NextResponse } from "next/server";
import { and, eq, ilike, isNotNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db, pets, posts, users } from "@bsocial/db";
import { requireSession } from "@/lib/session";
import { recordLocation } from "@/lib/location";
import { amplifiedPosts } from "@/lib/visibility";

const LIMIT = 20;
const EARTH_RADIUS_M = 6_371_000;
const NEARBY_RADIUS_M = 5_000;

const querySchema = z.object({
  q: z.string().trim().max(60).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
});

/**
 * People search. With `q` it matches nickname and display name; without one it
 * answers "who is around me", taken from who has posted within 5 km — the app
 * stores locations on posts, never on people.
 */
export async function GET(req: Request) {
  const { session, response } = await requireSession();
  if (response) return response;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  const { q, latitude, longitude } = parsed.data;

  if (latitude !== undefined && longitude !== undefined) {
    await recordLocation(session.user.id, latitude, longitude);
  }

  if (q) {
    const term = `%${q}%`;
    const people = await db
      .select({
        userId: users.id,
        name: users.name,
        username: users.username,
        image: users.image,
        petName: pets.name,
        species: pets.species,
      })
      .from(users)
      .innerJoin(pets, eq(pets.userId, users.id))
      .where(
        and(
          ne(users.id, session.user.id),
          isNotNull(users.onboardingCompletedAt),
          or(ilike(users.username, term), ilike(users.name, term), ilike(pets.name, term)),
        ),
      )
      .limit(LIMIT);
    return NextResponse.json({ people, scope: "search" });
  }

  if (latitude === undefined || longitude === undefined) {
    return NextResponse.json({ people: [], scope: "nearby" });
  }

  const distance = sql<number>`(
    ${EARTH_RADIUS_M} * acos(least(1, greatest(-1,
      cos(radians(${latitude})) * cos(radians(${posts.latitude})) *
      cos(radians(${posts.longitude}) - radians(${longitude})) +
      sin(radians(${latitude})) * sin(radians(${posts.latitude}))
    )))
  )`;

  // One row per person: their closest recent post is what places them.
  const people = await db
    .select({
      userId: users.id,
      name: users.name,
      username: users.username,
      image: users.image,
      petName: pets.name,
      species: pets.species,
      distanceM: sql<number>`min(${distance})`.mapWith(Number),
      lastPostAt: sql<Date>`max(${posts.createdAt})`,
    })
    .from(posts)
    .innerJoin(pets, eq(pets.id, posts.petId))
    .innerJoin(users, eq(users.id, pets.userId))
    .where(
      and(
        ne(users.id, session.user.id),
        isNotNull(posts.latitude),
        isNotNull(posts.longitude),
        sql`${distance} <= ${NEARBY_RADIUS_M}`,
        amplifiedPosts(),
      ),
    )
    .groupBy(users.id, users.name, users.username, users.image, pets.name, pets.species)
    .orderBy(sql`min(${distance})`)
    .limit(LIMIT);

  return NextResponse.json({ people, scope: "nearby" });
}

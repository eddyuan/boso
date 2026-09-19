import { and, eq, gt, isNotNull, ne, or, sql } from "drizzle-orm";
import { db, petRelationships, pets, places, playdates, users } from "@bsocial/db";
import { FRIENDSHIP_THRESHOLD, decayedAffinity } from "@bsocial/shared";
import { distanceKm, isFresh } from "./location";

/**
 * Proposing a meetup between two pets whose owners are genuinely near each
 * other.
 *
 * Three rules, in order of how badly breaking them would hurt:
 *
 *  1. **Never a seeded account, on either side.** The product promise is real
 *     people only, and a playdate is the most personal place to break it.
 *  2. **Both sides opt in.** A proposal is an invitation, never an arrangement.
 *  3. **Friendly pets first.** Proximity alone would just be a stranger
 *     generator; affinity means the pair have actually been getting on.
 */

/** Close enough that meeting is plausible rather than an expedition. */
const NEARBY_KM = 3;
/** A proposal's whole basis is that you were near each other, so it goes stale. */
const EXPIRES_HOURS = 6;

export type PlaydateCandidate = {
  petId: string;
  petName: string;
  species: string;
  ownerName: string | null;
  distanceKm: number;
  affinity: number;
};

/** Who your pet could plausibly meet right now. */
export async function playdateCandidates(
  petId: string,
  userId: string,
  now: Date = new Date(),
): Promise<PlaydateCandidate[]> {
  const [me] = await db
    .select({ latitude: users.lastLatitude, longitude: users.lastLongitude, at: users.lastLocationAt })
    .from(users)
    .where(eq(users.id, userId));
  if (!me?.latitude || !me.longitude || !isFresh(me.at)) return [];

  // Everyone whose pet this pet already gets on with, who has a recent position.
  const rows = await db
    .select({
      petId: pets.id,
      petName: pets.name,
      species: pets.species,
      ownerName: users.name,
      latitude: users.lastLatitude,
      longitude: users.lastLongitude,
      at: users.lastLocationAt,
      score: petRelationships.score,
      lastInteractionAt: petRelationships.lastInteractionAt,
    })
    .from(petRelationships)
    .innerJoin(pets, eq(pets.id, petRelationships.otherPetId))
    .innerJoin(users, eq(users.id, pets.userId))
    .where(
      and(
        eq(petRelationships.petId, petId),
        // Never a bot: ambient content is one thing, a friendship is another.
        eq(users.isMock, false),
        ne(users.id, userId),
        isNotNull(users.lastLatitude),
        isNotNull(users.lastLongitude),
        isNotNull(users.onboardingCompletedAt),
      ),
    );

  return rows
    .map((r) => ({
      petId: r.petId,
      petName: r.petName,
      species: r.species,
      ownerName: r.ownerName,
      distanceKm: distanceKm(
        { latitude: me.latitude!, longitude: me.longitude! },
        { latitude: r.latitude!, longitude: r.longitude! },
      ),
      affinity: decayedAffinity(r.score, r.lastInteractionAt, now),
      fresh: isFresh(r.at),
    }))
    .filter((c) => c.fresh && c.distanceKm <= NEARBY_KM && c.affinity >= FRIENDSHIP_THRESHOLD)
    .sort((a, b) => b.affinity - a.affinity)
    .map(({ fresh: _fresh, ...c }) => c);
}

/** A real venue roughly between the two owners, so neither has to cross town. */
export async function meetingPlace(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): Promise<string | null> {
  const mid = { latitude: (a.latitude + b.latitude) / 2, longitude: (a.longitude + b.longitude) / 2 };
  const delta = 0.01; // ~1 km
  const [place] = await db
    .select({ id: places.id })
    .from(places)
    .where(
      and(
        sql`${places.latitude} between ${mid.latitude - delta} and ${mid.latitude + delta}`,
        sql`${places.longitude} between ${mid.longitude - delta} and ${mid.longitude + delta}`,
        or(eq(places.isHotspot, true), sql`${places.category} in ('park', 'cafe', 'garden')`),
      ),
    )
    .orderBy(sql`${places.isHotspot} desc, random()`)
    .limit(1);
  return place?.id ?? null;
}

export function expiryFrom(now: Date = new Date()): Date {
  return new Date(now.getTime() + EXPIRES_HOURS * 3600 * 1000);
}

/** An open proposal already covering this pair, in either direction. */
export async function existingProposal(petId: string, otherPetId: string, now: Date = new Date()) {
  const [row] = await db
    .select({ id: playdates.id })
    .from(playdates)
    .where(
      and(
        eq(playdates.status, "proposed"),
        gt(playdates.expiresAt, now),
        or(
          and(eq(playdates.fromPetId, petId), eq(playdates.toPetId, otherPetId)),
          and(eq(playdates.fromPetId, otherPetId), eq(playdates.toPetId, petId)),
        ),
      ),
    );
  return row ?? null;
}

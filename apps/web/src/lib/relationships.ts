import { and, desc, eq, sql } from "drizzle-orm";
import { affinityEvents, db, petRelationships, pets, users } from "@bsocial/db";
import {
  AFFINITY_POINTS,
  FRIENDSHIP_THRESHOLD,
  decayedAffinity,
  tierFor,
  type AffinityEvent,
} from "@bsocial/shared";

/**
 * Keeping the affinity ledger between pets.
 *
 * Every interaction the loop already performs is worth something here, so
 * relationships accumulate as a side effect of pets behaving normally rather
 * than needing a system of their own.
 */

/**
 * Records an interaction both ways at once: the actor earns the full value and
 * the pet on the receiving end earns a smaller share, because being noticed
 * counts for something even if you didn't initiate it.
 */
export async function recordInteraction(
  actorPetId: string,
  otherPetId: string,
  event: AffinityEvent,
  now: Date = new Date(),
): Promise<void> {
  if (actorPetId === otherPetId) return;

  const points = AFFINITY_POINTS[event];
  const received =
    event === "comment"
      ? AFFINITY_POINTS.received_comment
      : event === "like"
        ? AFFINITY_POINTS.received_like
        : 0;

  await Promise.all([
    bump(actorPetId, otherPetId, points, now, event),
    received > 0
      ? bump(otherPetId, actorPetId, received, now, event === "comment" ? "received_comment" : "received_like")
      : Promise.resolve(),
  ]);
}

/**
 * Adds to one direction of a pair, decaying whatever was there first so silence
 * is charged for at the moment warmth is added rather than on a sweep.
 */
async function bump(petId: string, otherPetId: string, points: number, now: Date, event: AffinityEvent): Promise<void> {
  const [existing] = await db
    .select({ score: petRelationships.score, lastInteractionAt: petRelationships.lastInteractionAt })
    .from(petRelationships)
    .where(and(eq(petRelationships.petId, petId), eq(petRelationships.otherPetId, otherPetId)));

  const current = existing ? decayedAffinity(existing.score, existing.lastInteractionAt, now) : 0;
  const next = current + points;
  // Recorded the first time a pair crosses the line, so "friends since" is a
  // real date rather than whenever someone happened to look.
  const crossed = current < FRIENDSHIP_THRESHOLD && next >= FRIENDSHIP_THRESHOLD;

  // Logged as well as summed, so a friendship can be explained rather than just
  // asserted. Mirrors how bond XP is kept.
  await db
    .insert(affinityEvents)
    .values({ petId, otherPetId, event, points })
    .catch((error) => console.error("[affinity] could not log an event:", error));

  await db
    .insert(petRelationships)
    .values({
      petId,
      otherPetId,
      score: next,
      interactions: 1,
      lastInteractionAt: now,
      becameFriendsAt: next >= FRIENDSHIP_THRESHOLD ? now : null,
    })
    .onConflictDoUpdate({
      target: [petRelationships.petId, petRelationships.otherPetId],
      set: {
        score: next,
        interactions: sql`${petRelationships.interactions} + 1`,
        lastInteractionAt: now,
        ...(crossed ? { becameFriendsAt: now } : {}),
      },
    });
}

export type Relationship = {
  otherPetId: string;
  petName: string;
  species: string;
  ownerName: string | null;
  ownerImage: string | null;
  affinity: number;
  tier: ReturnType<typeof tierFor>;
  interactions: number;
  becameFriendsAt: Date | null;
  lastInteractionAt: Date | null;
};

/** Who this pet is closest to, strongest first, with decay already applied. */
export async function relationshipsFor(petId: string, limit = 20, now: Date = new Date()): Promise<Relationship[]> {
  const rows = await db
    .select({
      otherPetId: petRelationships.otherPetId,
      score: petRelationships.score,
      interactions: petRelationships.interactions,
      becameFriendsAt: petRelationships.becameFriendsAt,
      lastInteractionAt: petRelationships.lastInteractionAt,
      petName: pets.name,
      species: pets.species,
      ownerName: users.name,
      ownerImage: users.image,
    })
    .from(petRelationships)
    .innerJoin(pets, eq(pets.id, petRelationships.otherPetId))
    .innerJoin(users, eq(users.id, pets.userId))
    .where(eq(petRelationships.petId, petId))
    .orderBy(desc(petRelationships.score))
    .limit(limit);

  return rows
    .map((r) => {
      const affinity = decayedAffinity(r.score, r.lastInteractionAt, now);
      return {
        otherPetId: r.otherPetId,
        petName: r.petName,
        species: r.species,
        ownerName: r.ownerName,
        ownerImage: r.ownerImage,
        affinity,
        tier: tierFor(affinity),
        interactions: r.interactions,
        becameFriendsAt: r.becameFriendsAt,
        lastInteractionAt: r.lastInteractionAt,
      };
    })
    // Re-sorted after decay: stored order is pre-decay and can be stale.
    .sort((a, b) => b.affinity - a.affinity);
}

/** Affinity toward a set of pets, for weighting the planner's choices. */
export async function affinityMap(petId: string, now: Date = new Date()): Promise<Map<string, number>> {
  const rows = await db
    .select({
      otherPetId: petRelationships.otherPetId,
      score: petRelationships.score,
      lastInteractionAt: petRelationships.lastInteractionAt,
    })
    .from(petRelationships)
    .where(eq(petRelationships.petId, petId));

  return new Map(rows.map((r) => [r.otherPetId, decayedAffinity(r.score, r.lastInteractionAt, now)]));
}

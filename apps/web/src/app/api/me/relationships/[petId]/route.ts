import { NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { affinityEvents, db, petRelationships, pets, users } from "@bsocial/db";
import { AFFINITY_HALF_LIFE_DAYS, RELATIONSHIP_TIERS, decayedAffinity, tierFor } from "@bsocial/shared";
import { requireSession } from "@/lib/session";

const TIMELINE_LIMIT = 40;

/**
 * One friendship, and how it got there.
 *
 * The running score can only say "warmth 18". The event log is what turns that
 * into something a person can read — which is the same reason bond XP is kept as
 * a ledger rather than a counter.
 *
 * Only ever the signed-in user's own side of the pair: affinity is directional,
 * and how keen somebody else's pet is about yours is theirs to know.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ petId: string }> }) {
  const { session, response } = await requireSession();
  if (response) return response;

  const { petId: otherPetId } = await params;
  const [myPet] = await db.select({ id: pets.id, name: pets.name }).from(pets).where(eq(pets.userId, session.user.id));
  if (!myPet) return NextResponse.json({ error: "no_pet" }, { status: 400 });

  const [row] = await db
    .select({
      score: petRelationships.score,
      interactions: petRelationships.interactions,
      lastInteractionAt: petRelationships.lastInteractionAt,
      becameFriendsAt: petRelationships.becameFriendsAt,
      petName: pets.name,
      species: pets.species,
      ownerName: users.name,
      ownerImage: users.image,
      ownerIsMock: users.isMock,
    })
    .from(petRelationships)
    .innerJoin(pets, eq(pets.id, petRelationships.otherPetId))
    .innerJoin(users, eq(users.id, pets.userId))
    .where(and(eq(petRelationships.petId, myPet.id), eq(petRelationships.otherPetId, otherPetId)));

  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const now = new Date();
  const affinity = decayedAffinity(row.score, row.lastInteractionAt, now);

  const timeline = await db
    .select({ event: affinityEvents.event, points: affinityEvents.points, createdAt: affinityEvents.createdAt })
    .from(affinityEvents)
    .where(and(eq(affinityEvents.petId, myPet.id), eq(affinityEvents.otherPetId, otherPetId)))
    .orderBy(desc(affinityEvents.createdAt))
    .limit(TIMELINE_LIMIT);

  const [logged] = await db
    .select({ total: sql<number>`coalesce(sum(${affinityEvents.points}), 0)`.mapWith(Number) })
    .from(affinityEvents)
    .where(and(eq(affinityEvents.petId, myPet.id), eq(affinityEvents.otherPetId, otherPetId)));

  return NextResponse.json({
    myPetName: myPet.name,
    other: {
      petId: otherPetId,
      petName: row.petName,
      species: row.species,
      ownerName: row.ownerName,
      ownerImage: row.ownerImage,
      isReal: !row.ownerIsMock,
    },
    affinity,
    tier: tierFor(affinity),
    tiers: RELATIONSHIP_TIERS,
    interactions: row.interactions,
    becameFriendsAt: row.becameFriendsAt,
    lastInteractionAt: row.lastInteractionAt,
    halfLifeDays: AFFINITY_HALF_LIFE_DAYS,
    timeline,
    /**
     * Sum of the logged points, before decay. Older friendships predate the log,
     * so this can be below the score — the screen says as much rather than
     * implying the timeline is the whole story.
     */
    loggedTotal: logged?.total ?? 0,
  });
}

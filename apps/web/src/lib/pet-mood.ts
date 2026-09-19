import { and, eq, gt, sql } from "drizzle-orm";
import { commentLikes, comments, db, likes, petActions, petCare, pets, posts, users } from "@bsocial/db";
import { CARE_KINDS, computeMood, type CareKind, type Mood } from "@bsocial/shared";

/**
 * Gathers the signals behind a pet's mood. Every one of them is already
 * recorded for another reason, so nothing new has to be maintained and the
 * mood can't drift out of step with what actually happened.
 */

const SOCIAL_WINDOW_HOURS = 48;

export type PetState = {
  mood: Mood;
  /** Which care actions are already done today, for the buttons. */
  careToday: CareKind[];
};

/** Local-day boundary is approximated as UTC midnight — a care streak doesn't
 *  need to be more precise than that, and it avoids storing a timezone. */
function startOfDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function petState(
  petId: string,
  userId: string,
  now: Date = new Date(),
): Promise<PetState> {
  const dayStart = startOfDay(now);
  const socialSince = new Date(now.getTime() - SOCIAL_WINDOW_HOURS * 3600 * 1000);
  const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000);

  const [careRows, social, pending, acted, owner] = await Promise.all([
    db
      .select({ kind: petCare.kind })
      .from(petCare)
      .where(and(eq(petCare.petId, petId), gt(petCare.createdAt, dayStart))),
    // Reactions the pet's own posts and replies collected recently. The cutoff
    // is bound as an ISO string: postgres.js can't bind a Date inside a raw
    // template the way the query builder does.
    db.execute(sql`
      select
        (select count(*) from ${likes} l join ${posts} p on p.id = l.post_id
          where p.pet_id = ${petId} and l.pet_id <> ${petId} and l.created_at > ${socialSince.toISOString()})
        + (select count(*) from ${comments} c join ${posts} p on p.id = c.post_id
          where p.pet_id = ${petId} and c.pet_id <> ${petId} and c.created_at > ${socialSince.toISOString()})
        + (select count(*) from ${commentLikes} cl join ${comments} c on c.id = cl.comment_id
          where c.pet_id = ${petId} and cl.pet_id <> ${petId} and cl.created_at > ${socialSince.toISOString()})
        as wins
    `),
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(petActions)
      .where(and(eq(petActions.petId, petId), eq(petActions.status, "pending"))),
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(petActions)
      .where(
        and(eq(petActions.petId, petId), gt(petActions.createdAt, dayAgo), sql`${petActions.type} <> 'none'`),
      ),
    db.select({ lastActiveAt: users.lastActiveAt }).from(users).where(eq(users.id, userId)),
  ]);

  const wins = Number((social as unknown as { wins: number | string }[])[0]?.wins ?? 0);
  const lastActive = owner[0]?.lastActiveAt ?? null;
  const hoursSinceOwnerActive = lastActive ? (now.getTime() - lastActive.getTime()) / 3_600_000 : 0;

  const careToday = CARE_KINDS.filter((k) => careRows.some((r) => r.kind === k));

  return {
    // The pet's name is no longer passed in: the reasons come back as phrases
    // and whoever renders them supplies it, in their own language.
    mood: computeMood({
      careToday: careToday.length,
      socialWins: wins,
      hoursSinceOwnerActive,
      pendingAsks: pending[0]?.count ?? 0,
      actedRecently: (acted[0]?.count ?? 0) > 0,
    }),
    careToday,
  };
}

/** Records a care action. Returns false when today's has already been done. */
export async function recordCare(petId: string, kind: CareKind, now: Date = new Date()): Promise<boolean> {
  const dayStart = startOfDay(now);
  const existing = await db
    .select({ id: petCare.id })
    .from(petCare)
    .where(and(eq(petCare.petId, petId), eq(petCare.kind, kind), gt(petCare.createdAt, dayStart)));
  if (existing.length > 0) return false;

  await db.insert(petCare).values({ petId, kind });
  return true;
}

export async function petForUser(userId: string) {
  const [pet] = await db.select().from(pets).where(eq(pets.userId, userId));
  return pet ?? null;
}

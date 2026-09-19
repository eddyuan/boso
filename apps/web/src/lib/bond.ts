import { and, eq, gt, sql } from "drizzle-orm";
import { bondEvents, db, pets } from "@bsocial/db";
import { XP_VALUES, leveledUp, progressFor, type BondProgress, type XpEvent } from "@bsocial/shared";
import { getConfig } from "./config";

/**
 * Awarding bond XP.
 *
 * Every award is logged as well as summed, so the level can be explained
 * ("where did this come from?") rather than being an opaque number that only
 * goes up.
 */

export type AwardResult = {
  progress: BondProgress;
  /** Set when this award crossed a level — the moment worth marking. */
  leveledUpTo: ReturnType<typeof leveledUp>;
};

export async function awardXp(petId: string, event: XpEvent): Promise<AwardResult | null> {
  // Read live rather than from the constant, so a retune applies to the next
  // award instead of the next deploy. The constant remains the default.
  const { values } = await getConfig();
  const amount = values[`xp.${event}`] ?? XP_VALUES[event];

  const [before] = await db.select({ bondXp: pets.bondXp }).from(pets).where(eq(pets.id, petId));
  if (!before) return null;

  const [after] = await db
    .update(pets)
    .set({ bondXp: sql`${pets.bondXp} + ${amount}` })
    .where(eq(pets.id, petId))
    .returning({ bondXp: pets.bondXp });

  await db.insert(bondEvents).values({ petId, event, amount });

  return {
    progress: progressFor(after!.bondXp),
    leveledUpTo: leveledUp(before.bondXp, after!.bondXp),
  };
}

/** Fire-and-forget: XP must never be the reason a real action fails. */
export function awardXpQuietly(petId: string, event: XpEvent): void {
  void awardXp(petId, event).catch((error) => console.error("[bond] award failed:", error));
}

/**
 * Awards at most once per UTC day.
 *
 * For events triggered by reading rather than doing, where the act is real but
 * repeatable at no cost — opening the diary twice isn't twice the ritual. The
 * ledger is the dedupe key, so this needs no extra column and can't drift from
 * what was actually paid out.
 */
export async function awardXpOncePerDay(petId: string, event: XpEvent): Promise<AwardResult | null> {
  const now = new Date();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const [already] = await db
    .select({ id: bondEvents.id })
    .from(bondEvents)
    .where(and(eq(bondEvents.petId, petId), eq(bondEvents.event, event), gt(bondEvents.createdAt, dayStart)))
    .limit(1);
  if (already) return null;

  return awardXp(petId, event);
}

export async function bondFor(petId: string): Promise<BondProgress> {
  const [pet] = await db.select({ bondXp: pets.bondXp }).from(pets).where(eq(pets.id, petId));
  return progressFor(pet?.bondXp ?? 0);
}

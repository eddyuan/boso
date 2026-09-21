/**
 * The bond level: one permanent number that unlocks *expression*.
 *
 * Two constraints, both deliberate and both load-bearing:
 *
 *  1. **It gates expression, never reach.** Levels may lock cosmetics, treasure
 *     tiers and titles. They must never lock who you can see, meet or talk to.
 *     An earlier draft locked playdates until day 3–4 and local gossip until
 *     day 16 — which charges a new user days of grinding for exactly the social
 *     access that would have made them stay. Nothing in UNLOCKS below is a
 *     person, a place or a conversation.
 *
 *  2. **XP pays for the behaviour we want to be true.** Answering what your pet
 *     asked and meeting other pets are worth the most; daily care is a small
 *     floor. If tapping a food bowl were the fastest way to level, that would
 *     become the game.
 *
 * Levels never decay. Leaving for a fortnight costs nothing — mood is the thing
 * that droops and recovers, so the tug to return never takes something away.
 */

export const XP_VALUES = {
  /** The trust ritual, and the most distinctive thing in the product. */
  answer_ask: 25,
  /** Meeting someone new. */
  new_friendship: 30,
  /** Someone engaged with your pet's post. */
  received_reaction: 6,
  /** You replied to somebody. */
  wrote_reply: 8,
  /** You posted. */
  wrote_post: 10,
  /** An errand came home with something. */
  errand_returned: 12,
  /** Read last night's diary. */
  read_diary: 5,
  /** A daily care action. A floor, not the engine. */
  care: 4,
} as const;

export type XpEvent = keyof typeof XP_VALUES;

export type UnlockKind = "cosmetic" | "collection" | "expression" | "range" | "title";

export type LevelRow = {
  level: number;
  /** Cumulative XP to reach this level. */
  cum: number;
  unlock: string;
  kind: UnlockKind;
  /** Milestones worth a moment rather than a toast. */
  ceremony?: boolean;
};

/**
 * Twenty levels. Every unlock is something the pet *wears, carries, collects or
 * is called* — deliberately nothing that changes who the owner can reach.
 */
export const LEVELS: LevelRow[] = [
  { level: 1, cum: 0, unlock: "Everything social, and your pet's name, from the first minute", kind: "expression", ceremony: true },
  { level: 2, cum: 60, unlock: "A first collar", kind: "cosmetic" },
  { level: 3, cum: 180, unlock: "Treasure shelf — finds start coming home", kind: "collection", ceremony: true },
  { level: 4, cum: 330, unlock: "Two starter collars", kind: "cosmetic" },
  { level: 5, cum: 520, unlock: "Diary share cards", kind: "expression", ceremony: true },
  { level: 6, cum: 760, unlock: "Errands reach further across the map", kind: "range" },
  { level: 7, cum: 1050, unlock: "Scarf slot", kind: "cosmetic" },
  { level: 8, cum: 1400, unlock: "Uncommon treasures start appearing", kind: "collection" },
  { level: 9, cum: 1820, unlock: "Second collar set", kind: "cosmetic" },
  { level: 10, cum: 2320, unlock: "Hat slot; bigger errand bundles", kind: "cosmetic", ceremony: true },
  { level: 11, cum: 2900, unlock: "Diary keeps a full year", kind: "expression" },
  { level: 12, cum: 3580, unlock: "Rare treasures start appearing", kind: "collection" },
  { level: 13, cum: 4360, unlock: "Seasonal collar patterns", kind: "cosmetic" },
  { level: 14, cum: 5250, unlock: "Custom shelf arrangement", kind: "collection" },
  { level: 15, cum: 6260, unlock: "Friendship titles for your closest bonds", kind: "title", ceremony: true },
  { level: 16, cum: 7400, unlock: "Errands reach the whole neighbourhood", kind: "range" },
  { level: 17, cum: 8680, unlock: "Legendary treasures become possible", kind: "collection" },
  { level: 18, cum: 10110, unlock: "Pet portrait frames", kind: "cosmetic" },
  { level: 19, cum: 11700, unlock: "Keepsake case for retired treasures", kind: "collection" },
  { level: 20, cum: 13460, unlock: "Elder crown, kept forever", kind: "title", ceremony: true },
];

export const MAX_LEVEL = LEVELS[LEVELS.length - 1].level;

export type BondProgress = {
  level: number;
  xp: number;
  /** XP into the current level. */
  intoLevel: number;
  /** XP the current level spans; 0 at max. */
  levelSpan: number;
  /** null at max level. */
  next: LevelRow | null;
  xpToNext: number;
  unlocked: LevelRow[];
};

export function progressFor(xp: number): BondProgress {
  let current = LEVELS[0];
  for (const row of LEVELS) {
    if (xp >= row.cum) current = row;
  }
  const next = LEVELS.find((l) => l.level === current.level + 1) ?? null;

  return {
    level: current.level,
    xp,
    intoLevel: xp - current.cum,
    levelSpan: next ? next.cum - current.cum : 0,
    next,
    xpToNext: next ? Math.max(0, next.cum - xp) : 0,
    unlocked: LEVELS.filter((l) => l.level <= current.level),
  };
}

/** True when this XP award crossed a level boundary — the moment worth marking. */
export function leveledUp(before: number, after: number): LevelRow | null {
  const from = progressFor(before).level;
  const to = progressFor(after).level;
  return to > from ? (LEVELS.find((l) => l.level === to) ?? null) : null;
}

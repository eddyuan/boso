/**
 * The bond level: one permanent number that unlocks *expression*.
 *
 * Two constraints, both deliberate and both load-bearing:
 *
 *  1. **It gates expression, never reach.** Levels may lock cosmetics, treasure
 *     tiers, how far the pet wanders and how often. They must never lock who you
 *     can see, meet or talk to.
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
 * Twenty levels, in two halves.
 *
 *  - **1–10 decide what the pet can do.** Not what you can reach: everything
 *    social — the map, posting, replies, friendships, playdates, errands, the
 *    diary, the shelf — works from the first minute, and these levels only make
 *    the pet's own wandering deeper. Four tracks telling one story: it ranges
 *    further, goes out more often, brings back more, and finds rarer things.
 *  - **11–20 are cosmetic, and nothing else.** Once the capability ladder is
 *    finished at 10 there is nothing functional left to earn, so the long tail is
 *    entirely what the pet wears, carries and is called.
 *
 * This replaced a ladder where eleven of the twenty unlocks described features
 * that did not exist in any form, and none of the twenty were enforced anywhere.
 * Every unlock below is a number the code already had — a radius, a bundle size, a
 * rarity cap, a daily allowance — which is what makes the whole table buildable
 * rather than aspirational. All of them are live-tunable; see `config.ts`.
 *
 * The first half is deliberately quicker than the old curve: an engaged player
 * finishes the functional ladder in about a month rather than a month and a half,
 * while the cosmetic half stays long because cosmetics are allowed to be.
 */
export const LEVELS: LevelRow[] = [
  // ------------------------------------------------- 1-10: what the pet can do
  { level: 1, cum: 0, unlock: "Everything social, and your pet's name, from the first minute", kind: "expression", ceremony: true },
  { level: 2, cum: 40, unlock: "Uncommon finds start appearing", kind: "collection" },
  { level: 3, cum: 100, unlock: "Errands reach further across the map", kind: "range" },
  { level: 4, cum: 190, unlock: "Errands bring back more", kind: "range" },
  { level: 5, cum: 320, unlock: "Rare finds start appearing", kind: "collection", ceremony: true },
  { level: 6, cum: 490, unlock: "A third errand each day", kind: "range" },
  { level: 7, cum: 700, unlock: "Errands reach the whole neighbourhood", kind: "range" },
  { level: 8, cum: 960, unlock: "Errands bring back a full bundle", kind: "range" },
  { level: 9, cum: 1270, unlock: "Legendary finds become possible", kind: "collection", ceremony: true },
  { level: 10, cum: 1640, unlock: "A fourth errand each day, and your pet acts more often", kind: "range", ceremony: true },

  // ------------------------------------------------------ 11-20: cosmetic only
  { level: 11, cum: 2100, unlock: "Collar slot, and your first collars", kind: "cosmetic" },
  { level: 12, cum: 2650, unlock: "Scarf slot", kind: "cosmetic" },
  { level: 13, cum: 3300, unlock: "Seasonal collar patterns", kind: "cosmetic" },
  { level: 14, cum: 4050, unlock: "A second collar set", kind: "cosmetic" },
  { level: 15, cum: 4900, unlock: "Friendship titles for your closest bonds", kind: "title", ceremony: true },
  { level: 16, cum: 5900, unlock: "Hat slot", kind: "cosmetic" },
  { level: 17, cum: 7050, unlock: "Arrange your shelf how you like", kind: "collection" },
  { level: 18, cum: 8350, unlock: "Pet portrait frames", kind: "cosmetic" },
  { level: 19, cum: 9800, unlock: "Keepsake case for retired finds", kind: "collection" },
  { level: 20, cum: 11400, unlock: "Elder crown, kept forever", kind: "title", ceremony: true },
];

/** Past this, nothing functional is left to earn — everything above is cosmetic. */
export const LAST_CAPABILITY_LEVEL = 10;

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

// ---------------------------------------------------------------------------
// What a level actually gives you
//
// Levels 1–10 are the capability ladder, and each step is one of these numbers.
// Kept here beside `LEVELS` rather than at the four call sites, so the table and
// the thing it promises can't drift apart — the previous ladder's whole problem.
// ---------------------------------------------------------------------------

/** Rarity a pet can find at all, by level. Below the threshold it isn't rolled. */
export const RARITY_UNLOCKED_AT = {
  common: 1,
  uncommon: 2,
  rare: 5,
  legendary: 9,
} as const;

/**
 * The levels at which each errand number steps up.
 *
 * Only the levels live here. The *values* come from config — a floor and a
 * ceiling per track, with the middle step halfway between — so retuning how far a
 * pet ranges is an admin field rather than a deploy, and the ladder's copy stays
 * true because none of it promises a specific number.
 */
export const ERRAND_STEP_LEVELS = {
  radiusM: [1, 3, 7],
  bundle: [1, 4, 8],
  perDay: [1, 6, 10],
} as const;

/** Floor and ceiling per track. Defaults are the constants these replaced. */
export type ErrandTuning = {
  radiusStartM: number;
  radiusMaxM: number;
  bundleStart: number;
  bundleMax: number;
  perDayStart: number;
  perDayMax: number;
};

export const ERRAND_TUNING_DEFAULTS: ErrandTuning = {
  radiusStartM: 800,
  radiusMaxM: 3000,
  bundleStart: 4,
  bundleMax: 8,
  perDayStart: 2,
  perDayMax: 4,
};

/**
 * The value in force at `level` for one track.
 *
 * Three steps: the floor, the midpoint, the ceiling. A level between steps keeps
 * the previous value, and a ceiling below the floor simply never rises — nonsense
 * config degrades to a flat line rather than to later levels being worse.
 */
function trackValue(levels: readonly [number, number, number], from: number, to: number, level: number): number {
  const mid = Math.round((from + to) / 2);
  const values = [from, Math.max(from, mid), Math.max(from, to)];
  let value = values[0]!;
  for (let i = 0; i < levels.length; i++) if (level >= levels[i]!) value = values[i]!;
  return value;
}

/** Everything the capability ladder grants at a level, in one place. */
export function capabilitiesAt(level: number, tuning: ErrandTuning = ERRAND_TUNING_DEFAULTS) {
  return {
    errandRadiusM: trackValue(ERRAND_STEP_LEVELS.radiusM, tuning.radiusStartM, tuning.radiusMaxM, level),
    errandBundle: trackValue(ERRAND_STEP_LEVELS.bundle, tuning.bundleStart, tuning.bundleMax, level),
    errandsPerDay: trackValue(ERRAND_STEP_LEVELS.perDay, tuning.perDayStart, tuning.perDayMax, level),
    /** Rarities this pet can roll, commonest first. */
    rarities: (Object.keys(RARITY_UNLOCKED_AT) as (keyof typeof RARITY_UNLOCKED_AT)[]).filter(
      (r) => level >= RARITY_UNLOCKED_AT[r],
    ),
    /** Level 10's second half: the pet's own allowance goes up by this much. */
    bonusActionsPerDay: level >= LAST_CAPABILITY_LEVEL ? 2 : 0,
  };
}

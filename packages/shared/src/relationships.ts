/**
 * What two pets are to each other.
 *
 * The differentiator: everything else on the roadmap is straightforward to
 * copy, and this isn't. It generates stories worth telling — "my cockatiel and
 * the dog down the street have a thing going" — entirely out of the decision
 * log already being kept.
 *
 * Affinity is earned by interaction and lost to silence, so a friendship that
 * stops being fed fades instead of standing forever as a monument.
 */

/** What each kind of interaction is worth. Replying costs more than liking. */
export const AFFINITY_POINTS = {
  like: 1,
  visit: 0.5,
  comment: 3,
  follow: 5,
  /** Being replied to counts for the pet on the receiving end too. */
  received_comment: 2,
  received_like: 0.5,
} as const;

export type AffinityEvent = keyof typeof AFFINITY_POINTS;

/** Halves roughly monthly, so warmth needs upkeep but isn't lost overnight. */
export const AFFINITY_HALF_LIFE_DAYS = 30;

export const RELATIONSHIP_TIERS = [
  { id: "acquaintance", label: "Acquaintance", min: 0, blurb: "They've crossed paths" },
  { id: "friend", label: "Friend", min: 12, blurb: "They seek each other out" },
  { id: "close", label: "Close friend", min: 35, blurb: "Inseparable, frankly" },
  { id: "best", label: "Best friend", min: 70, blurb: "The bond of the neighbourhood" },
] as const;

export type RelationshipTier = (typeof RELATIONSHIP_TIERS)[number]["id"];

/** The score at which a pair stops being strangers and gets a name. */
export const FRIENDSHIP_THRESHOLD = RELATIONSHIP_TIERS[1].min;

type Tier = (typeof RELATIONSHIP_TIERS)[number];

export function tierFor(score: number): Tier {
  let tier: Tier = RELATIONSHIP_TIERS[0];
  for (const candidate of RELATIONSHIP_TIERS) {
    if (score >= candidate.min) tier = candidate;
  }
  return tier;
}

/** Current value of a stored score, after the silence since it was last touched. */
export function decayedAffinity(score: number, lastAt: Date | null, now: Date = new Date()): number {
  if (!lastAt) return score;
  const days = (now.getTime() - lastAt.getTime()) / 86_400_000;
  if (days <= 0) return score;
  return score * Math.pow(0.5, days / AFFINITY_HALF_LIFE_DAYS);
}

/**
 * How strongly the planner should favour this pet as a target. Affinity makes a
 * pet return to the same faces rather than scattering attention uniformly,
 * which is what makes a relationship legible from the outside.
 */
export function targetWeight(affinity: number): number {
  return 1 + Math.min(affinity, 60) / 15;
}

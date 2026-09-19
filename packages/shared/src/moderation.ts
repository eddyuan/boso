/**
 * Content classification rules, shared by the API (which enforces them) and the
 * apps (which render the result). Modelled on X: a post carries a category and a
 * severity, and those two together pick an action on a ladder that runs
 * allow → blur behind an interstitial → stop amplifying → hide → remove.
 */

export const SENSITIVE_CATEGORIES = [
  { value: "adult", label: "Adult content", blurb: "Nudity or sexual content" },
  { value: "violence", label: "Graphic violence", blurb: "Gore or graphic injury" },
  { value: "political", label: "Political", blurb: "Political or electoral content" },
  { value: "hate", label: "Hateful conduct", blurb: "Slurs or attacks on a protected group" },
  { value: "self_harm", label: "Self-harm", blurb: "Suicide or self-injury" },
  { value: "illegal", label: "Illegal goods", blurb: "Drugs, weapons or other regulated sales" },
  { value: "spam", label: "Spam", blurb: "Scams, bait or bulk repetition" },
] as const;

export type SensitiveCategory = (typeof SENSITIVE_CATEGORIES)[number]["value"];

export const SENSITIVE_CATEGORY_VALUES = SENSITIVE_CATEGORIES.map((c) => c.value) as SensitiveCategory[];

export const categoryLabel = (value: string) =>
  SENSITIVE_CATEGORIES.find((c) => c.value === value)?.label ?? value;

/** Per-category confidence, 0–1. Missing keys are treated as 0. */
export type ModerationScores = Partial<Record<SensitiveCategory, number>>;

export const MODERATION_STATUSES = [
  "pending", // not classified yet — created, awaiting the job
  "approved", // clean, shows normally
  "sensitive", // shows blurred behind an interstitial until tapped
  "restricted", // legal but not amplified: followers only, never Nearby/Discover
  "pending_review", // confidently flagged, hidden until a human decides
  "blocked", // removed, never shown
] as const;

export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

/**
 * Two thresholds rather than one, so the uncertain middle degrades gracefully:
 * a confident hit disappears pending review, while a maybe stays live but
 * blurred. One threshold would bury every false positive until a human got to
 * it, which with a single reviewer can be hours.
 */
export const SENSITIVE_THRESHOLD = 0.5;
export const REVIEW_THRESHOLD = 0.85;

/**
 * Categories that are never merely blurred. Hate speech and self-harm content
 * go straight to a human with the post hidden — blurring them still distributes
 * them, and for self-harm the right response is support, not a tap-to-reveal.
 */
export const ALWAYS_REVIEW_CATEGORIES: SensitiveCategory[] = ["hate", "self_harm"];

/** Legal but not amplified. A reviewer can still move these either way. */
export const RESTRICT_CATEGORIES: SensitiveCategory[] = ["political"];

export type Verdict = {
  status: ModerationStatus;
  categories: SensitiveCategory[];
};

/** Maps raw scores onto the ladder. Pure, so both sides agree and it's testable. */
export function verdictFromScores(scores: ModerationScores): Verdict {
  const over = (limit: number) =>
    SENSITIVE_CATEGORY_VALUES.filter((c) => (scores[c] ?? 0) >= limit);

  const flagged = over(SENSITIVE_THRESHOLD);
  if (flagged.length === 0) return { status: "approved", categories: [] };

  const needsHuman = over(REVIEW_THRESHOLD);
  const forcedReview = flagged.filter((c) => ALWAYS_REVIEW_CATEGORIES.includes(c));
  if (needsHuman.length > 0 || forcedReview.length > 0) {
    return { status: "pending_review", categories: [...new Set([...needsHuman, ...forcedReview, ...flagged])] };
  }

  // Only-political stays visible to followers rather than getting a blur that
  // implies it's unsafe; mixed with anything else, the blur wins.
  const onlyRestricted = flagged.every((c) => RESTRICT_CATEGORIES.includes(c));
  return { status: onlyRestricted ? "restricted" : "sensitive", categories: flagged };
}

/** Statuses whose posts exist for readers at all (subject to the rules below). */
export const READABLE_STATUSES: ModerationStatus[] = ["approved", "sensitive", "restricted"];

/** Never amplified: kept out of Nearby, Discover, search and the map. */
export const UNAMPLIFIED_STATUSES: ModerationStatus[] = ["restricted"];

/** True when the reader should see a tap-to-reveal cover rather than the media. */
export function shouldBlur(status: ModerationStatus, showSensitiveContent: boolean): boolean {
  return status === "sensitive" && !showSensitiveContent;
}

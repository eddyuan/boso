/**
 * Topics: the fine layer under the 20 onboarding INTERESTS. Every topic rolls
 * up to exactly one interest, so matching and the pet's reasoning keep working
 * on coarse buckets while the feed and analytics get something specific.
 *
 * The classifier may invent topics, which is the point — but unconstrained
 * tagging turns "coffee", "Coffee" and "cafés" into three unrelated rows and
 * quietly breaks matching. Everything below exists to stop that.
 */

/** A new topic is stored immediately but stays out of the UI until it's earned it. */
export const TOPIC_PROMOTION_THRESHOLD = 5;

export const TOPIC_STATUSES = [
  "auto", // created by the classifier, below the promotion threshold
  "approved", // popular enough (or admin-approved) to show in filters
  "hidden", // admin rejected it; kept so it isn't recreated next tick
] as const;

export type TopicStatus = (typeof TOPIC_STATUSES)[number];

export const MAX_TOPICS_PER_POST = 5;
export const TOPIC_SLUG_MAX = 40;

/**
 * Canonical slug form. Applied on every write, so the same concept can't enter
 * twice with different punctuation, case or accents.
 */
export function normalizeTopicSlug(raw: string): string {
  const slug = raw
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents: "cafés" -> "cafes"
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, TOPIC_SLUG_MAX)
    .replace(/-+$/g, "");
  return singularize(slug);
}

/**
 * Crude, deliberately conservative singularisation — enough to keep "tacos" and
 * "taco" together without mangling words that merely end in s.
 */
function singularize(slug: string): string {
  const parts = slug.split("-");
  const last = parts[parts.length - 1];
  if (!last || last.length < 4) return slug;
  if (/(ss|us|is|ies|s's)$/.test(last)) {
    if (last.endsWith("ies")) parts[parts.length - 1] = `${last.slice(0, -3)}y`;
    return parts.join("-");
  }
  if (last.endsWith("es") && /(ch|sh|x|z|s)es$/.test(last)) {
    parts[parts.length - 1] = last.slice(0, -2);
    return parts.join("-");
  }
  if (last.endsWith("s")) {
    parts[parts.length - 1] = last.slice(0, -1);
    return parts.join("-");
  }
  return slug;
}

/** Human label from a slug, for topics the model didn't label itself. */
export function topicLabelFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * How much a post contributes to its author's inferred interest in a topic,
 * halving roughly every 30 days so a profile follows what someone posts about
 * now rather than what they posted about a year ago.
 */
export const TOPIC_SCORE_HALF_LIFE_DAYS = 30;

export function decayedScore(confidence: number, ageMs: number): number {
  const days = ageMs / 86_400_000;
  return confidence * Math.pow(0.5, days / TOPIC_SCORE_HALF_LIFE_DAYS);
}

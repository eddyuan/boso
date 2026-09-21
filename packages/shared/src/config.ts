import { XP_VALUES } from "./bond";
import { MISSIONS_PER_DAY } from "./missions";
import { REVIEW_THRESHOLD, SENSITIVE_THRESHOLD } from "./moderation";
import { FIND_CHANCE } from "./treasures";

/**
 * The knobs an admin may turn without a deploy.
 *
 * Tielo behaves like a game, and a game gets retuned weekly — but every number
 * that shapes it was a hardcoded constant, so changing a drop rate meant a code
 * change, a review and a redeploy. These live in the database instead.
 *
 * Three rules decide what belongs here.
 *
 *  1. **Game feel and cost, nothing else.** `MIN_AGE` is a legal boundary,
 *     `EARTH_RADIUS_M` is physics, and `USERNAME_MAX` would invalidate rows
 *     already written. None of those are tuning; they stay in code where a
 *     change gets reviewed.
 *  2. **Every entry has bounds.** An unbounded live field is an outage waiting
 *     for a typo — a find chance of 18 instead of 0.18, a daily cap of 5000.
 *     The bounds are enforced on write *and* on read, so a value that predates a
 *     tightened bound can't leak through either.
 *  3. **The default is the constant it replaced.** An empty settings table must
 *     behave exactly like the code did before this existed.
 */

export type ConfigGroup = "economy" | "pets" | "social" | "map" | "notifications" | "moderation" | "cost";

export type ConfigField = {
  key: string;
  label: string;
  group: ConfigGroup;
  /** `int` renders without decimals and rejects fractions; `rate` is a 0–1 share. */
  type: "int" | "rate" | "hour";
  default: number;
  min: number;
  max: number;
  /** What it does, and what goes wrong at the extremes. */
  help: string;
  unit?: string;
};

export const CONFIG_FIELDS: ConfigField[] = [
  // ---------------------------------------------------------------- economy
  ...(Object.keys(XP_VALUES) as (keyof typeof XP_VALUES)[]).map<ConfigField>((event) => ({
    key: `xp.${event}`,
    label: `XP · ${event.replace(/_/g, " ")}`,
    group: "economy",
    type: "int",
    default: XP_VALUES[event],
    min: 0,
    max: 500,
    help:
      event === "care"
        ? "Daily care is meant to be a floor. If it out-earns answering an ask, tapping a food bowl becomes the game."
        : "Paid once per occurrence and written into the bond ledger at the value set here.",
    unit: "xp",
  })),
  {
    key: "treasures.findChance",
    label: "Treasure find chance",
    group: "economy",
    type: "rate",
    default: FIND_CHANCE,
    min: 0,
    max: 1,
    help: "Share of wanders that turn up anything. Most trips finding nothing is what makes a find feel like something; at 1 the shelf is noise.",
  },
  {
    key: "missions.perDay",
    label: "Missions offered per day",
    group: "economy",
    type: "int",
    default: MISSIONS_PER_DAY,
    min: 1,
    max: 7,
    help: "Drawn from the seven in the catalogue, stable for the day. Above about four it stops reading as a suggestion and starts reading as a chore list.",
  },

  // ---------------------------------------------------------------- errands
  //
  // The bond ladder's levels 1-10 step these three between the floor and the
  // ceiling below (see ERRAND_STEPS in bond.ts). Tuning the ends retunes the whole
  // ladder without touching the table — which is the point of the ladder being
  // numbers rather than features.
  { key: "errands.radiusStartM", label: "Errand radius at level 1", group: "economy", type: "int", default: 800, min: 100, max: 20000,
    help: "How far a level-1 errand searches. Wide enough and \"a few streets away\" stops being true.", unit: "m" },
  { key: "errands.radiusMaxM", label: "Errand radius at level 7", group: "economy", type: "int", default: 3000, min: 100, max: 50000,
    help: "The ceiling the ladder reaches. Below the level-1 value the steps invert and later levels search less.", unit: "m" },
  { key: "errands.bundleStart", label: "Errand bundle at level 1", group: "economy", type: "int", default: 4, min: 1, max: 20,
    help: "Posts brought home at level 1. More than a handful and the sheet stops being a peek." },
  { key: "errands.bundleMax", label: "Errand bundle at level 8", group: "economy", type: "int", default: 8, min: 1, max: 40,
    help: "The ceiling the ladder reaches." },
  { key: "errands.perDayStart", label: "Errands per day at level 1", group: "economy", type: "int", default: 2, min: 1, max: 50,
    help: "Also the cap on errand XP: without it each press paid out again with nothing to stop repeats." },
  { key: "errands.perDayMax", label: "Errands per day at level 10", group: "economy", type: "int", default: 4, min: 1, max: 100,
    help: "The ceiling the ladder reaches." },

  // ------------------------------------------------------------------- pets
  { key: "pets.maxActionsPerDay", label: "Pet actions per day", group: "pets", type: "int", default: 5, min: 0, max: 48,
    help: "The whole rolling-24h allowance. 0 stops pets acting without pausing the loop." },
  { key: "pets.maxPostsPerDay", label: "Pet posts per day", group: "pets", type: "int", default: 1, min: 0, max: 24,
    help: "Counts against the action allowance. More than a couple and a pet drowns out the people near it." },
  { key: "pets.maxCommentsPerDay", label: "Pet replies per day", group: "pets", type: "int", default: 2, min: 0, max: 24,
    help: "Also counts against the allowance." },

  // ----------------------------------------------------------------- social
  { key: "playdates.nearbyKm", label: "Playdate radius", group: "social", type: "int", default: 3, min: 1, max: 50,
    help: "How close two owners must be before a meetup is even suggested. Wide enough and you are proposing a journey, not a playdate.", unit: "km" },
  { key: "playdates.expiresHours", label: "Playdate invite lifetime", group: "social", type: "int", default: 6, min: 1, max: 72,
    help: "Proximity was the basis for suggesting it, so an invite that lingers overnight answers a question nobody is still asking.", unit: "h" },
  { key: "relationships.halfLifeDays", label: "Affinity half-life", group: "social", type: "int", default: 30, min: 1, max: 365,
    help: "How long warmth takes to halve without upkeep. Short values make friendships feel like chores.", unit: "days" },

  // -------------------------------------------------------------------- map
  { key: "map.hotspotPullM", label: "Gathering-spot pull", group: "map", type: "int", default: 900, min: 0, max: 5000,
    help: "How far a marked venue reaches to collect a pet's post. This is the whole of \"pets head for the park\".", unit: "m" },
  { key: "map.placeSnapM", label: "Ordinary venue snap", group: "map", type: "int", default: 150, min: 0, max: 2000,
    help: "The same for an unmarked venue. Raise it and everything lands on a pin; drop it to zero and the map scatters.", unit: "m" },
  { key: "errand.radiusM", label: "Errand radius", group: "map", type: "int", default: 800, min: 100, max: 20000,
    help: "How far a pet ranges when sent out. Wide enough and \"a few streets away\" stops being true.", unit: "m" },
  { key: "errand.bundleSize", label: "Errand haul size", group: "map", type: "int", default: 4, min: 1, max: 20,
    help: "How many things come back at most. Enough to feel like a haul, few enough to read in one sitting." },
  { key: "whiskers.minPosts", label: "Whiskers minimum posts", group: "map", type: "int", default: 3, min: 1, max: 20,
    help: "Below this there is no pattern worth reporting, and Whiskers stays quiet rather than padding." },

  // ---------------------------------------------------------- notifications
  { key: "push.dailyTotal", label: "Pushes per day, all kinds", group: "notifications", type: "int", default: 5, min: 0, max: 20,
    help: "The ceiling across every type, so several well-behaved categories can't gang up. 0 silences push without touching anything else." },
  { key: "push.capAsk", label: "Pushes · wants your OK", group: "notifications", type: "int", default: 3, min: 0, max: 20,
    help: "Per rolling day. The most important kind — a pet that asks fourteen questions in an afternoon should ask on screen, not in the tray." },
  { key: "push.capReply", label: "Pushes · somebody replied", group: "notifications", type: "int", default: 3, min: 0, max: 20,
    help: "Per rolling day. Someone answering you is the most welcome interruption there is, which is exactly why it can still be overdone." },
  { key: "push.capFriend", label: "Pushes · new friendship", group: "notifications", type: "int", default: 2, min: 0, max: 20,
    help: "Per rolling day. Rare by nature — if this cap is ever the limiting factor, something upstream is minting friendships too freely." },
  { key: "push.capQuiet", label: "Pushes · missing you", group: "notifications", type: "int", default: 1, min: 0, max: 20,
    help: "Per rolling day. The one most likely to feel like nagging, so it stays at one and fires only after a genuine gap." },
  { key: "push.quietFrom", label: "Quiet hours start", group: "notifications", type: "hour", default: 22, min: 0, max: 23,
    help: "Local hour, estimated from longitude — no timezone is stored." },
  { key: "push.quietUntil", label: "Quiet hours end", group: "notifications", type: "hour", default: 8, min: 0, max: 23,
    help: "Set equal to the start to disable quiet hours." },

  // ------------------------------------------------------------- moderation
  { key: "moderation.sensitiveThreshold", label: "Sensitive threshold", group: "moderation", type: "rate", default: SENSITIVE_THRESHOLD, min: 0, max: 1,
    help: "Confidence at which a category starts covering a post. Lower catches more and annoys more." },
  { key: "moderation.reviewThreshold", label: "Human-review threshold", group: "moderation", type: "rate", default: REVIEW_THRESHOLD, min: 0, max: 1,
    help: "Confidence at which a post is withheld for a person. Hate and self-harm always go to review regardless." },

  // ------------------------------------------------------------------- cost
  { key: "cost.autofillCellsPerDay", label: "Map cells bought per day", group: "cost", type: "int", default: 30, min: 0, max: 500,
    help: "The runaway guard on importing venues. Each cell costs roughly a dollar; 0 stops new areas being bought at all." },
  { key: "cost.autofillRequestsPerCell", label: "Requests per map cell", group: "cost", type: "int", default: 20, min: 1, max: 200,
    help: "Billed searches for one neighbourhood. Higher finds more venues and costs proportionally." },
  { key: "cost.photoPlacesPerCall", label: "Venues photographed per call", group: "cost", type: "int", default: 3, min: 0, max: 40,
    help: "Each venue costs up to ten billed photo fetches. 0 stops fetching images while still collecting handles." },
  { key: "cost.photoDetailsPerCall", label: "Venue lookups per call", group: "cost", type: "int", default: 5, min: 0, max: 40,
    help: "Place Details calls for venues with no photo handles yet, one billed request each." },
  { key: "cost.maxPhotosPerPlace", label: "Photos kept per venue", group: "cost", type: "int", default: 10, min: 0, max: 10,
    help: "Ten is the provider's own ceiling. Each one is a billed fetch and a stored object." },
];

export const CONFIG_BY_KEY = new Map(CONFIG_FIELDS.map((f) => [f.key, f]));

export const CONFIG_GROUPS: { id: ConfigGroup; label: string; blurb: string }[] = [
  { id: "economy", label: "Economy", blurb: "What effort is worth, and how often the world pays out." },
  { id: "pets", label: "Pet behaviour", blurb: "How much a pet may do on its own." },
  { id: "social", label: "Meeting people", blurb: "How close counts as nearby, and how fast warmth fades." },
  { id: "map", label: "The map", blurb: "Where posts settle and how far a pet ranges." },
  { id: "notifications", label: "Notifications", blurb: "The only channel that reaches a closed app, and the easiest to burn." },
  { id: "moderation", label: "Moderation", blurb: "How confident the classifier must be before it acts." },
  { id: "cost", label: "Spend limits", blurb: "Ceilings on calls to paid APIs. These protect the bill, not the game." },
];

/** Every key mapped to its default — what an empty settings table must behave like. */
export function configDefaults(): Record<string, number> {
  return Object.fromEntries(CONFIG_FIELDS.map((f) => [f.key, f.default]));
}

export type ConfigIssue = { key: string; reason: string };

/**
 * Coerces one stored value into something safe to use.
 *
 * Returns the default plus a reason whenever a value can't be trusted, rather
 * than throwing: a single bad row must never take the app down, and the reason
 * is what lets the admin page say *which* value was ignored and why.
 */
export function coerceConfigValue(field: ConfigField, raw: unknown): { value: number; issue?: ConfigIssue } {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return { value: field.default, issue: { key: field.key, reason: "not a finite number" } };
  }
  if (field.type !== "rate" && !Number.isInteger(raw)) {
    return { value: field.default, issue: { key: field.key, reason: "must be a whole number" } };
  }
  if (raw < field.min || raw > field.max) {
    return { value: field.default, issue: { key: field.key, reason: `outside ${field.min}–${field.max}` } };
  }
  return { value: raw };
}

/**
 * Builds the effective config from whatever is stored.
 *
 * Bounds are applied here as well as on write, so a value stored before a bound
 * was tightened — or edited straight in the database — still can't take effect.
 */
export function resolveConfig(stored: Record<string, unknown>): {
  values: Record<string, number>;
  issues: ConfigIssue[];
} {
  const values: Record<string, number> = {};
  const issues: ConfigIssue[] = [];
  for (const field of CONFIG_FIELDS) {
    if (!(field.key in stored)) {
      values[field.key] = field.default;
      continue;
    }
    const { value, issue } = coerceConfigValue(field, stored[field.key]);
    values[field.key] = value;
    if (issue) issues.push(issue);
  }
  return { values, issues };
}

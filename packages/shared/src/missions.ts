/**
 * Three light goals a day.
 *
 * They exist to orient a session for someone who opens the app without a
 * reason, so every one is achievable from things the app already does — no
 * mission asks for something the product can't deliver that day. Progress is
 * derived from signals already recorded rather than tracked separately, which
 * means a mission can never disagree with reality.
 *
 * Nothing here is a streak. Missing a day costs nothing and starts nothing
 * over: the goal is a nudge, not an obligation.
 */

import { XP_VALUES, type XpEvent } from "./bond";

export type MissionId =
  | "answer_ask"
  | "care_all"
  | "say_hello"
  | "write_post"
  | "send_errand"
  | "read_diary"
  | "meet_someone";

export type MissionDef = {
  id: MissionId;
  label: string;
  hint: string;
  target: number;
  /** Only offered when the app can actually satisfy it today. */
  requires?: "pending_ask" | "diary_entry" | "nearby_people";
};

export const MISSIONS: MissionDef[] = [
  { id: "answer_ask", label: "Answer your pet", hint: "Say yes or skip to what it asked", target: 1, requires: "pending_ask" },
  { id: "care_all", label: "A good day together", hint: "Feed, groom and play", target: 3 },
  { id: "say_hello", label: "Say something back", hint: "Reply to a post nearby", target: 1 },
  { id: "write_post", label: "Share something", hint: "Post from where you are", target: 1 },
  { id: "send_errand", label: "Send them out", hint: "Run one errand on the map", target: 1 },
  { id: "read_diary", label: "Catch up", hint: "Read last night's diary", target: 1, requires: "diary_entry" },
  { id: "meet_someone", label: "Make a friend", hint: "Meet a pet you haven't before", target: 1, requires: "nearby_people" },
];

/**
 * The bond-ledger event that proves each mission was done.
 *
 * Every mission maps to a real `XP_VALUES` key, which is what keeps the list
 * honest: a mission with no event behind it could never be completed, and the
 * type binding makes that a compile error rather than a silent zero.
 */
export const MISSION_PROGRESS_EVENT: Record<MissionId, XpEvent> = {
  answer_ask: "answer_ask",
  care_all: "care",
  say_hello: "wrote_reply",
  write_post: "wrote_post",
  send_errand: "errand_returned",
  read_diary: "read_diary",
  meet_someone: "new_friendship",
};

/**
 * What completing a mission is worth — derived, never stored.
 *
 * The reward is whatever the bond already pays for the underlying act, so the
 * number shown next to a mission is the number that lands. A separate mission
 * XP table would be a second source of truth that silently drifts from the
 * first, which is exactly the bug this replaced.
 */
export function missionXp(m: MissionDef, xpValues?: Partial<Record<XpEvent, number>>): number {
  const event = MISSION_PROGRESS_EVENT[m.id];
  // The live table when one is supplied, so what a mission advertises and what
  // the bond pays can't come from different places.
  return m.target * (xpValues?.[event] ?? XP_VALUES[event]);
}

export const MISSIONS_PER_DAY = 3;

export const MISSION_BY_ID = new Map(MISSIONS.map((m) => [m.id, m]));

/** Deterministic [0,1) from a string, so a day's missions are stable. */
function seeded(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = (h + 0x6d2b79f5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The day's three, chosen from what's actually possible right now and stable
 * for the whole day — a list that reshuffles on every refresh isn't a goal.
 */
export function missionsFor(
  userId: string,
  day: string,
  available: Set<string>,
  perDay: number = MISSIONS_PER_DAY,
): MissionDef[] {
  const eligible = MISSIONS.filter((m) => !m.requires || available.has(m.requires));
  const rng = seeded(`${userId}:${day}`);

  const pool = [...eligible];
  const chosen: MissionDef[] = [];
  while (pool.length > 0 && chosen.length < perDay) {
    chosen.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]!);
  }
  return chosen;
}

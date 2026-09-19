import { desc, eq, gte, sql } from "drizzle-orm";
import {
  bondEvents,
  comments,
  db,
  liveEvents,
  petTreasures,
  pets,
  placeImports,
  posts,
  users,
} from "@bsocial/db";
import {
  FIND_CHANCE,
  LEVELS,
  MISSION_PROGRESS_EVENT,
  MISSIONS,
  TREASURE_BY_ID,
  TREASURE_RARITIES,
  XP_VALUES,
  progressFor,
  type MissionId,
} from "@bsocial/shared";

/**
 * Reading the economy back out.
 *
 * Every number here is derived from rows that already exist — the bond ledger,
 * the treasure finds, the posts. Nothing new is tracked, because a separate
 * counter is a second source of truth that drifts from the first.
 *
 * The point is to make the *configured* number and the *actual* number sit next
 * to each other. A drop rate set to 18% that pays out at 31% is a bug nobody
 * finds by reading the constant.
 */

export type XpBySource = { event: string; awards: number; xp: number; configured: number };

/** Where XP actually came from, against what each event is meant to pay. */
export async function xpBySource(sinceDays: number): Promise<XpBySource[]> {
  const since = new Date(Date.now() - sinceDays * 86_400_000);
  const rows = await db
    .select({
      event: bondEvents.event,
      awards: sql<number>`count(*)`.mapWith(Number),
      xp: sql<number>`coalesce(sum(${bondEvents.amount}), 0)`.mapWith(Number),
    })
    .from(bondEvents)
    .where(gte(bondEvents.createdAt, since))
    .groupBy(bondEvents.event)
    .orderBy(sql`sum(${bondEvents.amount}) desc`);

  return rows.map((r) => ({
    ...r,
    configured: (XP_VALUES as Record<string, number>)[r.event] ?? 0,
  }));
}

export type LevelBucket = { level: number; unlock: string; pets: number };

/**
 * How many pets sit at each level.
 *
 * Computed from `pets.bond_xp` through the same `progressFor` the app uses, so
 * the histogram can't disagree with what a player is shown.
 */
export async function levelDistribution(): Promise<LevelBucket[]> {
  const rows = await db
    .select({ bondXp: pets.bondXp })
    .from(pets)
    .innerJoin(users, eq(users.id, pets.userId))
    .where(eq(users.isMock, false));

  const counts = new Map<number, number>();
  for (const r of rows) {
    const level = progressFor(r.bondXp ?? 0).level;
    counts.set(level, (counts.get(level) ?? 0) + 1);
  }
  return LEVELS.map((l) => ({ level: l.level, unlock: l.unlock, pets: counts.get(l.level) ?? 0 }));
}

export type DropStats = {
  finds: number;
  wanders: number;
  /** Actual find rate, or null when there's nothing to divide by. */
  actualRate: number | null;
  configuredRate: number;
  byRarity: { rarity: string; label: string; finds: number; actualShare: number | null; configuredShare: number }[];
};

/**
 * Treasure drops, actual against configured.
 *
 * "Wanders" is approximated by the pet actions that could have produced a find —
 * errand returns are the only trips currently rolled for, so the denominator is
 * the count of those. Stated rather than hidden, because a rate is meaningless
 * without knowing what it divides by.
 */
export async function dropStats(sinceDays: number): Promise<DropStats> {
  const since = new Date(Date.now() - sinceDays * 86_400_000);

  const [finds, rolls] = await Promise.all([
    db
      .select({ kind: petTreasures.kind, n: sql<number>`count(*)`.mapWith(Number) })
      .from(petTreasures)
      .where(gte(petTreasures.foundAt, since))
      .groupBy(petTreasures.kind),
    db
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(bondEvents)
      .where(sql`${bondEvents.event} = 'errand_returned' and ${bondEvents.createdAt} >= ${since.toISOString()}`),
  ]);

  const total = finds.reduce((n, f) => n + f.n, 0);
  const wanders = rolls[0]?.n ?? 0;

  const weightTotal = TREASURE_RARITIES.reduce((n, r) => n + r.weight, 0);
  const byRarity = TREASURE_RARITIES.map((r) => {
    const n = finds
      .filter((f) => TREASURE_BY_ID.get(f.kind)?.rarity === r.id)
      .reduce((acc, f) => acc + f.n, 0);
    return {
      rarity: r.id,
      label: r.label,
      finds: n,
      actualShare: total > 0 ? n / total : null,
      configuredShare: r.weight / weightTotal,
    };
  });

  return {
    finds: total,
    wanders,
    actualRate: wanders > 0 ? total / wanders : null,
    configuredRate: FIND_CHANCE,
    byRarity,
  };
}

export type MissionStat = { id: MissionId; label: string; xp: number; completions: number; conditional: boolean };

/**
 * How often each mission is actually finished.
 *
 * Completions come from the bond ledger, since that is what a mission is
 * measured by. A mission sitting at zero is either impossible to reach or not
 * worth reaching — both worth knowing, and indistinguishable from the code.
 */
export async function missionStats(sinceDays: number): Promise<MissionStat[]> {
  const since = new Date(Date.now() - sinceDays * 86_400_000);
  const rows = await db
    .select({ event: bondEvents.event, n: sql<number>`count(*)`.mapWith(Number) })
    .from(bondEvents)
    .where(gte(bondEvents.createdAt, since))
    .groupBy(bondEvents.event);
  const byEvent = new Map(rows.map((r) => [r.event, r.n]));

  return MISSIONS.map((m) => ({
    id: m.id,
    label: m.label,
    xp: m.target * (XP_VALUES as Record<string, number>)[MISSION_PROGRESS_EVENT[m.id]],
    completions: byEvent.get(MISSION_PROGRESS_EVENT[m.id]) ?? 0,
    conditional: Boolean(m.requires),
  }));
}

export type EventStat = {
  id: string;
  title: string;
  goal: string;
  target: number;
  startsAt: Date;
  endsAt: Date;
  running: boolean;
};

export async function eventHistory(): Promise<EventStat[]> {
  const now = new Date();
  const rows = await db.select().from(liveEvents).orderBy(desc(liveEvents.startsAt)).limit(10);
  return rows.map((e) => ({
    id: e.id,
    title: e.title,
    goal: e.goal,
    target: e.target,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    running: e.startsAt < now && e.endsAt > now,
  }));
}

export type ActivityStat = { day: string; posts: number; petPosts: number; replies: number };

/** Human vs pet output per day — the "is the room real yet" number. */
export async function activityByDay(sinceDays: number): Promise<ActivityStat[]> {
  const since = new Date(Date.now() - sinceDays * 86_400_000);
  const [p, c] = await Promise.all([
    db
      .select({
        day: sql<string>`date_trunc('day', ${posts.createdAt})::date::text`,
        posts: sql<number>`count(*) filter (where ${posts.authoredByAgent} = false)`.mapWith(Number),
        petPosts: sql<number>`count(*) filter (where ${posts.authoredByAgent} = true)`.mapWith(Number),
      })
      .from(posts)
      .where(gte(posts.createdAt, since))
      .groupBy(sql`date_trunc('day', ${posts.createdAt})`),
    db
      .select({
        day: sql<string>`date_trunc('day', ${comments.createdAt})::date::text`,
        replies: sql<number>`count(*)`.mapWith(Number),
      })
      .from(comments)
      .where(gte(comments.createdAt, since))
      .groupBy(sql`date_trunc('day', ${comments.createdAt})`),
  ]);

  const byDay = new Map<string, ActivityStat>();
  for (const r of p) byDay.set(r.day, { day: r.day, posts: r.posts, petPosts: r.petPosts, replies: 0 });
  for (const r of c) {
    const row = byDay.get(r.day) ?? { day: r.day, posts: 0, petPosts: 0, replies: 0 };
    row.replies = r.replies;
    byDay.set(r.day, row);
  }
  return [...byDay.values()].sort((a, b) => b.day.localeCompare(a.day));
}

/** Cells bought from the places provider, for the cost page's headroom line. */
export async function importedCells(sinceDays: number): Promise<{ cells: number; found: number; requests: number }> {
  const since = new Date(Date.now() - sinceDays * 86_400_000);
  const [row] = await db
    .select({
      cells: sql<number>`count(*)`.mapWith(Number),
      found: sql<number>`coalesce(sum(${placeImports.found}), 0)`.mapWith(Number),
      requests: sql<number>`coalesce(sum(${placeImports.requests}), 0)`.mapWith(Number),
    })
    .from(placeImports)
    .where(gte(placeImports.createdAt, since));
  return row ?? { cells: 0, found: 0, requests: 0 };
}

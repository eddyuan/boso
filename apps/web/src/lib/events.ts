import { and, eq, gt, lt, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  comments,
  db,
  liveEvents,
  petTreasures,
  pets,
  playdates,
  posts,
  users,
} from "@bsocial/db";

/**
 * Counting a neighbourhood's shared progress.
 *
 * Two rules do the work here.
 *
 * **Nothing is stored.** Progress is counted from the rows that already record
 * the activity, so the bar can never disagree with what actually happened, and
 * there's no counter to repair when a post is deleted or a playdate expires.
 *
 * **Seeded accounts don't count.** Bots may make a neighbourhood look inhabited
 * — that's what they're for — but a collective achievement they filled in is a
 * lie about activity, and here it would be a legible one, expressed as a number
 * with a target next to it. Every count is restricted to real users.
 */

export type LiveEvent = typeof liveEvents.$inferSelect;

export type EventProgress = {
  event: LiveEvent;
  /** Everyone's contributions added up. */
  total: number;
  /** Yours alone, shown only to you. */
  yours: number;
  /** 0–1, clamped: a goal that's been beaten shows as full, not as 140%. */
  fraction: number;
  hoursLeft: number;
};

/** The event running right now, or null. */
export async function currentEvent(now: Date = new Date()): Promise<LiveEvent | null> {
  const [row] = await db
    .select()
    .from(liveEvents)
    .where(and(lt(liveEvents.startsAt, now), gt(liveEvents.endsAt, now)))
    .orderBy(liveEvents.startsAt)
    .limit(1);
  return row ?? null;
}

/**
 * Restricts a count to the event's area.
 *
 * Uses a bounding box rather than a true radius. For deciding whether a whole
 * neighbourhood's activity counts, a square is close enough — and unlike the
 * hotspot snap, nothing here turns on the exact edge, so the extra corner is
 * cheaper than a distance calculation per row.
 */
function withinArea(event: LiveEvent, latCol: unknown, lngCol: unknown) {
  if (event.latitude === null || event.longitude === null || event.radiusKm === null) return undefined;
  const latDelta = event.radiusKm / 111;
  const lngDelta = latDelta / Math.max(Math.cos((event.latitude * Math.PI) / 180), 0.01);
  return sql`${latCol} between ${event.latitude - latDelta} and ${event.latitude + latDelta}
    and ${lngCol} between ${event.longitude - lngDelta} and ${event.longitude + lngDelta}`;
}

/** Real users only — see the note at the top of this file. */
const realUser = sql`${users.isMock} = false`;

export async function eventProgress(event: LiveEvent, userId: string): Promise<EventProgress> {
  const [total, yours] = await Promise.all([countFor(event, null), countFor(event, userId)]);

  return {
    event,
    total,
    yours,
    fraction: event.target > 0 ? Math.min(1, total / event.target) : 0,
    hoursLeft: Math.max(0, (event.endsAt.getTime() - Date.now()) / 3_600_000),
  };
}

/**
 * One count, for everybody or for one person.
 *
 * `onlyUserId` is the only difference between the shared total and someone's own
 * contribution, so the two can't drift into counting different things — which is
 * what would make a personal number that doesn't add up to the bar.
 */
async function countFor(event: LiveEvent, onlyUserId: string | null): Promise<number> {
  const window = (col: AnyPgColumn) => and(gt(col, event.startsAt), lt(col, event.endsAt));
  const mine = onlyUserId ? eq(users.id, onlyUserId) : undefined;
  const n = sql<number>`count(*)`.mapWith(Number);

  switch (event.goal) {
    case "treasures_found": {
      const [row] = await db
        .select({ n })
        .from(petTreasures)
        .innerJoin(pets, eq(pets.id, petTreasures.petId))
        .innerJoin(users, eq(users.id, pets.userId))
        .where(and(window(petTreasures.foundAt), realUser, mine));
      return row?.n ?? 0;
    }
    case "posts_written": {
      const [row] = await db
        .select({ n })
        .from(posts)
        .innerJoin(pets, eq(pets.id, posts.petId))
        .innerJoin(users, eq(users.id, pets.userId))
        .where(
          and(
            window(posts.createdAt),
            realUser,
            mine,
            // The person's own words. A pet's posts are the room looking busy,
            // not the neighbourhood turning up.
            eq(posts.authoredByAgent, false),
            withinArea(event, posts.latitude, posts.longitude),
          ),
        );
      return row?.n ?? 0;
    }
    case "replies_written": {
      const [row] = await db
        .select({ n })
        .from(comments)
        .innerJoin(pets, eq(pets.id, comments.petId))
        .innerJoin(users, eq(users.id, pets.userId))
        .where(and(window(comments.createdAt), realUser, mine, eq(comments.authoredByAgent, false)));
      return row?.n ?? 0;
    }
    case "playdates_met": {
      const [row] = await db
        .select({ n })
        .from(playdates)
        .innerJoin(pets, eq(pets.id, playdates.fromPetId))
        .innerJoin(users, eq(users.id, pets.userId))
        .where(
          and(
            gt(playdates.respondedAt, event.startsAt),
            lt(playdates.respondedAt, event.endsAt),
            eq(playdates.status, "accepted"),
            realUser,
            mine,
          ),
        );
      return row?.n ?? 0;
    }
    case "places_visited": {
      // Distinct venues, not visits: the goal is covering the neighbourhood,
      // so twenty posts from one café shouldn't finish it.
      const [row] = await db
        .select({ n: sql<number>`count(distinct ${posts.placeId})`.mapWith(Number) })
        .from(posts)
        .innerJoin(pets, eq(pets.id, posts.petId))
        .innerJoin(users, eq(users.id, pets.userId))
        .where(
          and(
            window(posts.createdAt),
            realUser,
            mine,
            sql`${posts.placeId} is not null`,
            withinArea(event, posts.latitude, posts.longitude),
          ),
        );
      return row?.n ?? 0;
    }
  }
}

export const GOAL_LABEL: Record<LiveEvent["goal"], string> = {
  treasures_found: "treasures found",
  posts_written: "posts",
  replies_written: "replies",
  playdates_met: "playdates",
  places_visited: "places visited",
};

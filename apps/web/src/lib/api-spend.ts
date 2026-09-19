import { and, gte, sql } from "drizzle-orm";
import { apiCalls, db } from "@bsocial/db";

/**
 * Recording what somebody else's API cost us.
 *
 * Every paid call goes through here. The point is not accounting precision — it
 * is that spend becomes *visible before the invoice*, and attributable to a
 * feature rather than a lump sum.
 *
 * Recording must never be able to break the thing it is measuring, so every
 * failure here is swallowed. A lost row is a gap in a chart; a thrown error
 * would be a failed place import.
 */

export type ApiProvider = "google_places" | "gemini" | "expo_push";

/**
 * Indicative unit prices in micro-dollars (millionths).
 *
 * Deliberately approximate and deliberately local: these are list prices at the
 * time of writing, not a billing integration, and they exist so a chart can say
 * "about $14 yesterday" instead of "1,900 calls yesterday". Cost is stamped onto
 * each row at call time, so changing a rate here never rewrites history.
 */
export const RATE_MICROS: Record<string, number> = {
  // Places API (New). Nearby Search and Details are the expensive ones.
  "google_places:nearby_search": 32_000,
  "google_places:place_details": 17_000,
  "google_places:place_photo": 7_000,
  // Gemini Flash Lite is cheap per call; these are rough per-call averages
  // rather than per-token, which is all a spend chart needs.
  "gemini:text": 300,
  "gemini:object": 400,
  "gemini:image": 39_000,
  // Free, but worth counting — a spike here means the caps aren't working.
  "expo_push:send": 0,
};

export function rateFor(provider: ApiProvider, kind: string): number {
  return RATE_MICROS[`${provider}:${kind}`] ?? 0;
}

export type RecordCall = {
  provider: ApiProvider;
  kind: string;
  /** Billed units; a batch of 10 photos is 10. */
  units?: number;
  ok?: boolean;
  meta?: Record<string, unknown>;
};

/**
 * Logs one billed call. Fire-and-forget: callers should not await this on a hot
 * path, and must not depend on it succeeding.
 */
export async function recordApiCall(call: RecordCall): Promise<void> {
  const units = call.units ?? 1;
  try {
    await db.insert(apiCalls).values({
      provider: call.provider,
      kind: call.kind,
      units,
      costMicros: rateFor(call.provider, call.kind) * units,
      ok: call.ok ?? true,
      meta: call.meta ?? null,
    });
  } catch (error) {
    console.error("[spend] could not record an api call:", error);
  }
}

/** Same, without the await — for call sites that must not slow down. */
export function recordApiCallQuietly(call: RecordCall): void {
  void recordApiCall(call);
}

export type SpendRow = {
  provider: string;
  kind: string;
  calls: number;
  units: number;
  failed: number;
  costMicros: number;
};

/** Spend grouped by provider and kind over a window. */
export async function spendByKind(sinceDays: number): Promise<SpendRow[]> {
  const since = new Date(Date.now() - sinceDays * 86_400_000);
  const rows = await db
    .select({
      provider: apiCalls.provider,
      kind: apiCalls.kind,
      calls: sql<number>`count(*)`.mapWith(Number),
      units: sql<number>`coalesce(sum(${apiCalls.units}), 0)`.mapWith(Number),
      failed: sql<number>`count(*) filter (where ${apiCalls.ok} = false)`.mapWith(Number),
      costMicros: sql<number>`coalesce(sum(${apiCalls.costMicros}), 0)`.mapWith(Number),
    })
    .from(apiCalls)
    .where(gte(apiCalls.createdAt, since))
    .groupBy(apiCalls.provider, apiCalls.kind)
    .orderBy(sql`sum(${apiCalls.costMicros}) desc`);
  return rows;
}

/** Daily totals, for the trend line. */
export async function spendByDay(sinceDays: number): Promise<{ day: string; calls: number; costMicros: number }[]> {
  const since = new Date(Date.now() - sinceDays * 86_400_000);
  return db
    .select({
      day: sql<string>`date_trunc('day', ${apiCalls.createdAt})::date::text`,
      calls: sql<number>`count(*)`.mapWith(Number),
      costMicros: sql<number>`coalesce(sum(${apiCalls.costMicros}), 0)`.mapWith(Number),
    })
    .from(apiCalls)
    .where(gte(apiCalls.createdAt, since))
    .groupBy(sql`date_trunc('day', ${apiCalls.createdAt})`)
    .orderBy(sql`date_trunc('day', ${apiCalls.createdAt}) desc`);
}

/** What today has cost so far, for the headroom readout. */
export async function spendToday(): Promise<{ calls: number; costMicros: number }> {
  const now = new Date();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const [row] = await db
    .select({
      calls: sql<number>`count(*)`.mapWith(Number),
      costMicros: sql<number>`coalesce(sum(${apiCalls.costMicros}), 0)`.mapWith(Number),
    })
    .from(apiCalls)
    .where(and(gte(apiCalls.createdAt, dayStart)));
  return row ?? { calls: 0, costMicros: 0 };
}

/** Micro-dollars as money, at the precision the number deserves. */
export function formatMicros(micros: number): string {
  const dollars = micros / 1_000_000;
  if (dollars === 0) return "$0";
  if (dollars < 0.01) return `$${dollars.toFixed(4)}`;
  if (dollars < 10) return `$${dollars.toFixed(2)}`;
  return `$${Math.round(dollars).toLocaleString()}`;
}

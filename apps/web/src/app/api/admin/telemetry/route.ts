import { NextResponse } from "next/server";
import { z } from "zod";
import { spendByDay, spendByKind, spendToday } from "@/lib/api-spend";
import {
  activityByDay,
  dropStats,
  eventHistory,
  importedCells,
  levelDistribution,
  missionStats,
  xpBySource,
} from "@/lib/telemetry";
import { requireSession } from "@/lib/session";

/**
 * Everything the telemetry page reads, in one request.
 *
 * One endpoint rather than six: the page shows them together, and six parallel
 * round trips would make it flash in pieces on a cold serverless start.
 */
export async function GET(req: Request) {
  const { response } = await requireSession({ requireAdmin: true });
  if (response) return response;

  const parsed = z
    .object({ days: z.coerce.number().int().min(1).max(365).default(30) })
    .safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  const { days } = parsed.data;

  const [xp, levels, drops, missions, events, activity, cells, byKind, byDay, today] = await Promise.all([
    xpBySource(days),
    levelDistribution(),
    dropStats(days),
    missionStats(days),
    eventHistory(),
    activityByDay(days),
    importedCells(days),
    spendByKind(days),
    spendByDay(days),
    spendToday(),
  ]);

  return NextResponse.json({
    days,
    economy: { xp, levels, drops, missions, events, activity },
    spend: { byKind, byDay, today, cells },
  });
}

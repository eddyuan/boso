import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db, jobRuns } from "@bsocial/db";

/**
 * Watching the background jobs.
 *
 * There was no way to tell whether a scheduled job had run. If the nightly diary
 * stopped, the symptom would be users noticing their pet had gone quiet — weeks
 * later, with nothing to look at.
 *
 * Instrumentation wraps the handler rather than living inside it, so a job can't
 * be added without being watched and a job's own code stays about its own work.
 */

/** Every scheduled or event-driven function, with what "healthy" looks like. */
export const JOBS: {
  id: string;
  label: string;
  trigger: string;
  /** Hours after which silence is suspicious. Null for event-driven work. */
  staleAfterHours: number | null;
  /** The event that makes it run now, when it can be triggered by hand. */
  event?: string;
  blurb: string;
}[] = [
  { id: "schedule-pet-ticks", label: "Schedule pet ticks", trigger: "every hour", staleAfterHours: 2,
    event: "admin/run.schedule-pet-ticks",
    blurb: "Fans out one tick per pet. If this stops, every pet stops acting at once." },
  { id: "run-pet-tick", label: "Pet tick", trigger: "on pet/tick", staleAfterHours: 2,
    blurb: "One pet decides whether to do something. The busiest job by far." },
  { id: "classify-post", label: "Classify a post", trigger: "on post/created", staleAfterHours: null,
    blurb: "Topics and safety. A backlog here means posts sit unclassified and invisible to Nearby." },
  { id: "schedule-mock-posts", label: "Schedule persona posts", trigger: "every hour", staleAfterHours: 2,
    event: "admin/run.schedule-mock-posts",
    blurb: "Works out which seeded personas are due." },
  { id: "run-mock-post", label: "Persona post", trigger: "on mock/post", staleAfterHours: null,
    blurb: "One persona writes. Costs a model call, and an image call when it illustrates." },
  { id: "comeback-nudges", label: "Comeback nudges", trigger: "daily", staleAfterHours: 26,
    event: "admin/run.comeback-nudges",
    blurb: "The only push that goes to someone who hasn't opened the app." },
  { id: "write-diaries", label: "Write diaries", trigger: "daily 06:20 UTC", staleAfterHours: 26,
    event: "admin/run.write-diaries",
    blurb: "Writes yesterday for every pet that did something. Skipped days can't be backfilled." },
  { id: "morning-digest", label: "Morning digest", trigger: "daily", staleAfterHours: 26,
    event: "admin/run.morning-digest",
    blurb: "One recap instead of six pings. Runs after the diaries." },
];

export const JOB_BY_ID = new Map(JOBS.map((j) => [j.id, j]));

/**
 * Runs `fn`, recording the attempt either way.
 *
 * The row is inserted before the work starts, so a run that never finishes still
 * leaves a trace — a killed worker or a timeout produces no log line otherwise,
 * and those are the failures worth catching.
 *
 * Recording never changes the outcome: a bookkeeping failure is logged and
 * swallowed, and the handler's error is always rethrown so Inngest still sees it
 * and retries as configured.
 */
export async function tracked<T>(job: string, fn: () => Promise<T>, manual = false): Promise<T> {
  let runId: string | null = null;
  const startedAt = Date.now();

  try {
    const [row] = await db.insert(jobRuns).values({ job, manual }).returning({ id: jobRuns.id });
    runId = row?.id ?? null;
  } catch (error) {
    console.error("[jobs] could not open a run row for", job, error);
  }

  const close = async (status: "succeeded" | "failed", extra: Record<string, unknown>) => {
    if (!runId) return;
    try {
      await db
        .update(jobRuns)
        .set({ status, finishedAt: new Date(), durationMs: Date.now() - startedAt, ...extra })
        .where(eq(jobRuns.id, runId));
    } catch (error) {
      console.error("[jobs] could not close the run row for", job, error);
    }
  };

  try {
    const result = await fn();
    // Only plain objects are worth keeping; a large payload would bloat the table.
    const keep = result && typeof result === "object" && !Array.isArray(result) ? result : { value: result };
    await close("succeeded", { result: keep });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await close("failed", { error: message.slice(0, 500) });
    throw error;
  }
}

export type JobHealth = {
  id: string;
  label: string;
  trigger: string;
  blurb: string;
  event?: string;
  staleAfterHours: number | null;
  lastRunAt: Date | null;
  lastSuccessAt: Date | null;
  lastStatus: "running" | "succeeded" | "failed" | null;
  lastDurationMs: number | null;
  lastError: string | null;
  runs24h: number;
  failures24h: number;
  /** True when a job with a schedule hasn't succeeded inside its window. */
  stale: boolean;
  /** True when nothing has ever been recorded — new, or never wired to a scheduler. */
  neverRun: boolean;
};

export async function jobHealth(): Promise<JobHealth[]> {
  const dayAgo = new Date(Date.now() - 86_400_000);

  const [latest, successes, counts] = await Promise.all([
    // The most recent attempt per job, whatever became of it.
    db
      .select({
        job: jobRuns.job,
        status: jobRuns.status,
        startedAt: jobRuns.startedAt,
        durationMs: jobRuns.durationMs,
        error: jobRuns.error,
      })
      .from(jobRuns)
      .orderBy(desc(jobRuns.startedAt))
      .limit(500),
    db
      .select({ job: jobRuns.job, at: sql<Date>`max(${jobRuns.startedAt})` })
      .from(jobRuns)
      .where(eq(jobRuns.status, "succeeded"))
      .groupBy(jobRuns.job),
    db
      .select({
        job: jobRuns.job,
        runs: sql<number>`count(*)`.mapWith(Number),
        failures: sql<number>`count(*) filter (where ${jobRuns.status} = 'failed')`.mapWith(Number),
      })
      .from(jobRuns)
      .where(gte(jobRuns.startedAt, dayAgo))
      .groupBy(jobRuns.job),
  ]);

  const firstSeen = new Map<string, (typeof latest)[number]>();
  for (const r of latest) if (!firstSeen.has(r.job)) firstSeen.set(r.job, r);
  const lastOk = new Map(successes.map((s) => [s.job, new Date(s.at)]));
  const byJob = new Map(counts.map((c) => [c.job, c]));

  const now = Date.now();
  return JOBS.map((j) => {
    const last = firstSeen.get(j.id) ?? null;
    const ok = lastOk.get(j.id) ?? null;
    const c = byJob.get(j.id);
    const stale =
      j.staleAfterHours !== null && (ok === null || now - ok.getTime() > j.staleAfterHours * 3_600_000);

    return {
      id: j.id,
      label: j.label,
      trigger: j.trigger,
      blurb: j.blurb,
      event: j.event,
      staleAfterHours: j.staleAfterHours,
      lastRunAt: last?.startedAt ?? null,
      lastSuccessAt: ok,
      lastStatus: last?.status ?? null,
      lastDurationMs: last?.durationMs ?? null,
      lastError: last?.error ?? null,
      runs24h: c?.runs ?? 0,
      failures24h: c?.failures ?? 0,
      stale,
      neverRun: last === null,
    };
  });
}

export type RecentRun = {
  id: string;
  job: string;
  status: string;
  startedAt: Date;
  durationMs: number | null;
  error: string | null;
  manual: boolean;
};

export async function recentRuns(job?: string, limit = 40): Promise<RecentRun[]> {
  return db
    .select({
      id: jobRuns.id,
      job: jobRuns.job,
      status: jobRuns.status,
      startedAt: jobRuns.startedAt,
      durationMs: jobRuns.durationMs,
      error: jobRuns.error,
      manual: jobRuns.manual,
    })
    .from(jobRuns)
    .where(job ? and(eq(jobRuns.job, job)) : undefined)
    .orderBy(desc(jobRuns.startedAt))
    .limit(limit);
}

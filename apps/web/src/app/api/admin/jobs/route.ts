import { NextResponse } from "next/server";
import { z } from "zod";
import { inngest } from "@/inngest/client";
import { JOB_BY_ID, jobHealth, recentRuns } from "@/lib/jobs";
import { requireSession } from "@/lib/session";

/** Health of every background job, plus the recent run log. */
export async function GET(req: Request) {
  const { response } = await requireSession({ requireAdmin: true });
  if (response) return response;

  const job = new URL(req.url).searchParams.get("job") ?? undefined;
  const [health, runs] = await Promise.all([jobHealth(), recentRuns(job)]);
  return NextResponse.json({ health, runs });
}

const runSchema = z.object({ job: z.string().min(1).max(80) });

/**
 * Runs a job now.
 *
 * Sends the job's own admin event rather than invoking the handler here: the work
 * then happens on a worker with its own retries and step memoisation, exactly as
 * a scheduled run would. Calling the handler inline would execute in a request
 * that can time out halfway, which is the failure mode this page exists to catch.
 */
export async function POST(req: Request) {
  const { response } = await requireSession({ requireAdmin: true });
  if (response) return response;

  const parsed = runSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const job = JOB_BY_ID.get(parsed.data.job);
  if (!job) return NextResponse.json({ error: "unknown_job" }, { status: 404 });
  if (!job.event) {
    return NextResponse.json({ error: "not_triggerable", reason: "This job only runs in response to its own event." }, { status: 400 });
  }

  try {
    await inngest.send({ name: job.event as "admin/run.write-diaries", data: {} });
  } catch (error) {
    // Almost always a missing INNGEST_EVENT_KEY or no worker reachable — worth
    // saying plainly, since "nothing happened" is the same symptom as a job that
    // ran and did nothing.
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "send_failed", reason: message }, { status: 502 });
  }

  return NextResponse.json({ ok: true, queued: job.event });
}

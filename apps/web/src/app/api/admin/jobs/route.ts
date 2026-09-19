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
    // "Nothing happened" looks identical to "ran and did nothing", so the reason
    // has to be specific enough to act on. The two failures here are both about
    // *which mode* Inngest picked, which is decided by NODE_ENV rather than by
    // the keys — the part that surprises people.
    const message = error instanceof Error ? error.message : String(error);
    const cloud = !/^dev/i.test(process.env.NODE_ENV ?? "") || process.env.INNGEST_DEV === "0";
    let reason = message;

    if (/event key not found|401/i.test(message)) {
      reason =
        "Inngest rejected the event key. This build is talking to Inngest Cloud (chosen by NODE_ENV/VERCEL_ENV, not by the keys), " +
        "so INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY must both be set to real values from app.inngest.com — " +
        `blank counts as missing. Currently EVENT_KEY is ${process.env.INNGEST_EVENT_KEY ? "set" : "blank"} ` +
        `and SIGNING_KEY is ${process.env.INNGEST_SIGNING_KEY ? "set" : "blank"}. ` +
        "To use a local dev server from a production build instead, set INNGEST_DEV=1.";
    } else if (/ECONNREFUSED|fetch failed|8288/i.test(message) && !cloud) {
      reason =
        "No Inngest dev server is listening on 127.0.0.1:8288. Start one with: " +
        "npx inngest-cli@latest dev -u http://localhost:3000/api/inngest";
    }

    return NextResponse.json({ error: "send_failed", reason, mode: cloud ? "cloud" : "dev" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, queued: job.event });
}

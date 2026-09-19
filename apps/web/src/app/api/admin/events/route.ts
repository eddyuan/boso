import { NextResponse } from "next/server";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db, liveEvents } from "@bsocial/db";
import { currentEvent, eventProgress, GOAL_LABEL } from "@/lib/events";
import { requireSession } from "@/lib/session";

/** Scheduling the collective events, and seeing how the running one is doing. */

const GOALS = ["treasures_found", "posts_written", "replies_written", "playdates_met", "places_visited"] as const;

const bodySchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    blurb: z.string().trim().max(300).optional(),
    goal: z.enum(GOALS),
    target: z.number().int().min(1).max(1_000_000),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    // An area needs all three or none: a radius with no centre means nothing.
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    radiusKm: z.number().min(0.1).max(500).optional(),
  })
  .refine((v) => new Date(v.endsAt) > new Date(v.startsAt), {
    message: "endsAt must be after startsAt",
    path: ["endsAt"],
  })
  .refine(
    (v) =>
      [v.latitude, v.longitude, v.radiusKm].every((x) => x === undefined) ||
      [v.latitude, v.longitude, v.radiusKm].every((x) => x !== undefined),
    { message: "set latitude, longitude and radiusKm together, or none of them", path: ["radiusKm"] },
  );

export async function GET() {
  const { session, response } = await requireSession({ requireAdmin: true });
  if (response) return response;

  const [events, running] = await Promise.all([
    db.select().from(liveEvents).orderBy(desc(liveEvents.startsAt)).limit(50),
    currentEvent(),
  ]);

  // The running event's numbers, so an admin can see whether a target is
  // reachable before it quietly expires unmet.
  const progress = running ? await eventProgress(running, session.user.id) : null;

  return NextResponse.json({
    events: events.map((e) => ({ ...e, goalLabel: GOAL_LABEL[e.goal] })),
    running: progress
      ? { id: running!.id, total: progress.total, target: running!.target, fraction: progress.fraction }
      : null,
  });
}

export async function POST(req: Request) {
  const { response } = await requireSession({ requireAdmin: true });
  if (response) return response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const v = parsed.data;

  const [event] = await db
    .insert(liveEvents)
    .values({
      title: v.title,
      blurb: v.blurb ?? null,
      goal: v.goal,
      target: v.target,
      startsAt: new Date(v.startsAt),
      endsAt: new Date(v.endsAt),
      latitude: v.latitude ?? null,
      longitude: v.longitude ?? null,
      radiusKm: v.radiusKm ?? null,
    })
    .returning();

  return NextResponse.json({ event }, { status: 201 });
}

export async function DELETE(req: Request) {
  const { response } = await requireSession({ requireAdmin: true });
  if (response) return response;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });

  await db.delete(liveEvents).where(eq(liveEvents.id, id));
  return NextResponse.json({ ok: true });
}

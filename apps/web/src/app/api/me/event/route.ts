import { NextResponse } from "next/server";
import { currentEvent, eventProgress, GOAL_LABEL } from "@/lib/events";
import { requireSession } from "@/lib/session";

/**
 * The event running now, with the neighbourhood's shared progress and your own
 * contribution. Your number is only ever your own — there is no endpoint that
 * returns anyone else's, because a per-person breakdown is the ranking this was
 * deliberately built instead of.
 */
export async function GET() {
  const { session, response } = await requireSession();
  if (response) return response;

  const event = await currentEvent();
  if (!event) return NextResponse.json({ event: null });

  const progress = await eventProgress(event, session.user.id);
  return NextResponse.json({
    event: {
      id: event.id,
      title: event.title,
      blurb: event.blurb,
      goal: event.goal,
      goalLabel: GOAL_LABEL[event.goal],
      target: event.target,
      endsAt: event.endsAt,
    },
    total: progress.total,
    yours: progress.yours,
    fraction: progress.fraction,
    hoursLeft: Math.round(progress.hoursLeft),
  });
}

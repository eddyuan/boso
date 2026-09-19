import { NextResponse } from "next/server";
import { and, eq, gt, sql } from "drizzle-orm";
import { bondEvents, db, petActions, petDiary, pets } from "@bsocial/db";
import { MISSION_PROGRESS_EVENT, missionXp, missionsFor, type XpEvent } from "@bsocial/shared";
import { getConfig } from "@/lib/config";
import { playdateCandidates } from "@/lib/playdates";
import { requireSession } from "@/lib/session";

/**
 * Today's three goals, and how far along they are.
 *
 * Progress is read from the bond ledger rather than tracked separately. Every
 * act a mission asks for already writes a `bond_events` row, so the ledger is
 * both the reward and the evidence — a mission can't claim you haven't done
 * something the bond already paid you for. It also means every mission is
 * completable by construction: if there were no event to count, there would be
 * no XP to award either.
 *
 * A mission is only offered when the app can actually satisfy it today, so
 * nobody is asked to answer a question their pet never asked.
 */
export async function GET() {
  const { session, response } = await requireSession();
  if (response) return response;

  const [pet] = await db.select({ id: pets.id }).from(pets).where(eq(pets.userId, session.user.id));
  if (!pet) return NextResponse.json({ missions: [] });

  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const dayStart = new Date(`${day}T00:00:00.000Z`);
  const yesterday = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);

  const [earned, pendingAsks, diaryEntry, nearby] = await Promise.all([
    db
      .select({ event: bondEvents.event, count: sql<number>`count(*)`.mapWith(Number) })
      .from(bondEvents)
      .where(and(eq(bondEvents.petId, pet.id), gt(bondEvents.createdAt, dayStart)))
      .groupBy(bondEvents.event),
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(petActions)
      .where(and(eq(petActions.petId, pet.id), eq(petActions.status, "pending"))),
    db
      .select({ id: petDiary.id })
      .from(petDiary)
      .where(and(eq(petDiary.petId, pet.id), eq(petDiary.day, yesterday))),
    // Never let a proximity lookup fail the whole list; the worst case is one
    // fewer mission offered today.
    playdateCandidates(pet.id, session.user.id, now).catch(() => []),
  ]);

  const counts = new Map(earned.map((r) => [r.event, r.count]));

  // The same live values the bond pays from, so an advertised reward is the
  // reward. Reading these from the constants instead would let the two drift the
  // moment anyone retunes XP.
  const { values } = await getConfig();
  const liveXp = Object.fromEntries(
    Object.values(MISSION_PROGRESS_EVENT).map((e) => [e, values[`xp.${e}`]]),
  ) as Partial<Record<XpEvent, number>>;

  const available = new Set<string>();
  // Answered asks count too: finishing the mission mustn't remove it from the
  // list it was completed on.
  if ((pendingAsks[0]?.count ?? 0) > 0 || (counts.get("answer_ask") ?? 0) > 0) available.add("pending_ask");
  if (diaryEntry.length > 0) available.add("diary_entry");
  if (nearby.length > 0) available.add("nearby_people");

  const missions = missionsFor(session.user.id, day, available, values["missions.perDay"]).map((m) => {
    const progress = counts.get(MISSION_PROGRESS_EVENT[m.id]) ?? 0;
    // The id, not the wording: the app words it from the catalogue in the
    // reader's language. `requires` is a server-side filter and has no reader.
    return {
      id: m.id,
      target: m.target,
      xp: missionXp(m, liveXp),
      progress: Math.min(progress, m.target),
      done: progress >= m.target,
    };
  });

  return NextResponse.json({ day, missions });
}

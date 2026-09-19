import { NextResponse } from "next/server";
import { and, desc, eq, gt, or } from "drizzle-orm";
import { z } from "zod";
import { db, pets, places, playdates, users } from "@bsocial/db";
import { awardXpQuietly } from "@/lib/bond";
import { existingProposal, expiryFrom, meetingPlace, playdateCandidates } from "@/lib/playdates";
import { sendPush } from "@/lib/push";
import { recordInteraction } from "@/lib/relationships";
import { requireSession } from "@/lib/session";

/** Who you could meet, and what's already been proposed either way. */
export async function GET() {
  const { session, response } = await requireSession();
  if (response) return response;

  const [myPet] = await db.select({ id: pets.id }).from(pets).where(eq(pets.userId, session.user.id));
  if (!myPet) return NextResponse.json({ candidates: [], invites: [], sent: [] });

  const now = new Date();
  const fromPet = { name: pets.name, species: pets.species };

  const [candidates, open] = await Promise.all([
    playdateCandidates(myPet.id, session.user.id, now),
    db
      .select({
        id: playdates.id,
        fromPetId: playdates.fromPetId,
        toPetId: playdates.toPetId,
        status: playdates.status,
        expiresAt: playdates.expiresAt,
        placeName: places.name,
        otherPetName: fromPet.name,
        otherSpecies: fromPet.species,
      })
      .from(playdates)
      .innerJoin(pets, eq(pets.id, playdates.fromPetId))
      .leftJoin(places, eq(places.id, playdates.placeId))
      .where(
        and(
          eq(playdates.status, "proposed"),
          gt(playdates.expiresAt, now),
          or(eq(playdates.toPetId, myPet.id), eq(playdates.fromPetId, myPet.id)),
        ),
      )
      .orderBy(desc(playdates.createdAt)),
  ]);

  return NextResponse.json({
    candidates,
    invites: open.filter((p) => p.toPetId === myPet.id),
    sent: open.filter((p) => p.fromPetId === myPet.id),
  });
}

const proposeSchema = z.object({ toPetId: z.string().uuid() });

/** Propose a meetup. An invitation, never an arrangement — they have to accept. */
export async function POST(req: Request) {
  const { session, response } = await requireSession();
  if (response) return response;

  const parsed = proposeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const [myPet] = await db
    .select({ id: pets.id, name: pets.name })
    .from(pets)
    .where(eq(pets.userId, session.user.id));
  if (!myPet) return NextResponse.json({ error: "no_pet" }, { status: 400 });

  // Re-checked here rather than trusted from the client: the candidate list is
  // a suggestion, and this is the gate.
  const candidates = await playdateCandidates(myPet.id, session.user.id);
  const target = candidates.find((c) => c.petId === parsed.data.toPetId);
  if (!target) return NextResponse.json({ error: "not_a_candidate" }, { status: 400 });

  if (await existingProposal(myPet.id, target.petId)) {
    return NextResponse.json({ error: "already_proposed" }, { status: 409 });
  }

  const [me, them] = await Promise.all([
    db
      .select({ latitude: users.lastLatitude, longitude: users.lastLongitude })
      .from(users)
      .where(eq(users.id, session.user.id)),
    db
      .select({ userId: users.id, latitude: users.lastLatitude, longitude: users.lastLongitude })
      .from(pets)
      .innerJoin(users, eq(users.id, pets.userId))
      .where(eq(pets.id, target.petId)),
  ]);

  const placeId =
    me[0]?.latitude && me[0].longitude && them[0]?.latitude && them[0].longitude
      ? await meetingPlace(
          { latitude: me[0].latitude, longitude: me[0].longitude },
          { latitude: them[0].latitude, longitude: them[0].longitude },
        )
      : null;

  const [row] = await db
    .insert(playdates)
    .values({ fromPetId: myPet.id, toPetId: target.petId, placeId, expiresAt: expiryFrom() })
    .returning();

  if (them[0]) {
    await sendPush(them[0].userId, {
      type: "pet_friend",
      title: `${target.petName} has been invited out`,
      body: `${myPet.name} is nearby and wants to meet up.`,
      data: { screen: "activity", playdateId: row!.id },
    }).catch(() => {});
  }

  return NextResponse.json({ playdate: row }, { status: 201 });
}

const respondSchema = z.object({ id: z.string().uuid(), accept: z.boolean() });

export async function PATCH(req: Request) {
  const { session, response } = await requireSession();
  if (response) return response;

  const parsed = respondSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const [myPet] = await db.select({ id: pets.id }).from(pets).where(eq(pets.userId, session.user.id));
  if (!myPet) return NextResponse.json({ error: "no_pet" }, { status: 400 });

  // Only the invitee can answer, which is what "both opt in" means in practice.
  const [invite] = await db
    .select()
    .from(playdates)
    .where(and(eq(playdates.id, parsed.data.id), eq(playdates.toPetId, myPet.id)));
  if (!invite) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (invite.status !== "proposed") {
    return NextResponse.json({ error: "already_answered", status: invite.status }, { status: 409 });
  }

  const status = parsed.data.accept ? "accepted" : "declined";
  await db.update(playdates).set({ status, respondedAt: new Date() }).where(eq(playdates.id, invite.id));

  if (parsed.data.accept) {
    // Meeting is the strongest signal two pets get on, and it pays both sides.
    await recordInteraction(myPet.id, invite.fromPetId, "follow").catch(() => {});
    awardXpQuietly(myPet.id, "new_friendship");
    awardXpQuietly(invite.fromPetId, "new_friendship");
  }

  return NextResponse.json({ ok: true, status });
}

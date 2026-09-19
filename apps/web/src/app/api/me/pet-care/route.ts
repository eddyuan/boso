import { NextResponse } from "next/server";
import { z } from "zod";
import { CARE_KINDS } from "@bsocial/shared";
import { petForUser, petState, recordCare } from "@/lib/pet-mood";
import { requireSession } from "@/lib/session";

const bodySchema = z.object({ kind: z.enum(CARE_KINDS) });

/**
 * Feed, groom or play — once each per day. Deliberately tiny: it's a reason to
 * open the app, not a chore to fall behind on, so missing a day costs nothing
 * and there's no streak to break.
 */
export async function POST(req: Request) {
  const { session, response } = await requireSession();
  if (response) return response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const pet = await petForUser(session.user.id);
  if (!pet) return NextResponse.json({ error: "no_pet" }, { status: 400 });

  const recorded = await recordCare(pet.id, parsed.data.kind);
  const state = await petState(pet.id, session.user.id, pet.name);

  // Already done today isn't an error — the UI just catches up.
  return NextResponse.json({ recorded, ...state });
}

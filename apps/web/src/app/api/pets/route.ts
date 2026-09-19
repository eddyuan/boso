import { NextResponse } from "next/server";
import { bondFor } from "@/lib/bond";
import { petForUser, petState } from "@/lib/pet-mood";
import { XP_VALUES } from "@bsocial/shared";
import { getConfig } from "@/lib/config";
import { requireSession } from "@/lib/session";

// The signed-in user's pet (one per user, created during onboarding via
// POST /api/me/onboarding/pet), with how it's feeling and what care is left.
export async function GET() {
  const { session, response } = await requireSession();
  if (response) return response;

  const pet = await petForUser(session.user.id);
  if (!pet) return NextResponse.json({ pet: null, mood: null, careToday: [], bond: null });

  const [state, bond, { values }] = await Promise.all([
    petState(pet.id, session.user.id),
    bondFor(pet.id),
    getConfig(),
  ]);

  // The live award values, so the bond screen shows what the ledger will actually
  // pay. Rendering the shipped constants here would drift the moment anyone
  // retunes XP — the same trap the missions endpoint had to avoid.
  const xpValues = Object.fromEntries(
    (Object.keys(XP_VALUES) as (keyof typeof XP_VALUES)[]).map((e) => [e, values[`xp.${e}`] ?? XP_VALUES[e]]),
  );

  return NextResponse.json({ pet, ...state, bond, xpValues });
}

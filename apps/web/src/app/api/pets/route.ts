import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, pets } from "@bsocial/db";
import { bondFor } from "@/lib/bond";
import { petForUser, petState } from "@/lib/pet-mood";
import { PET_NAME_MAX, XP_VALUES } from "@bsocial/shared";
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

const renameSchema = z.object({
  name: z.string().trim().min(1).max(PET_NAME_MAX),
});

/**
 * Rename the pet.
 *
 * **Open from day one, deliberately.** The bond ladder used to advertise
 * "Give your pet a nickname" as a level-2 unlock, which was wrong twice over: it
 * was never enforced anywhere, and a name is the most basic thing you own about a
 * companion — earning the right to fix a typo is a bad first hour.
 *
 * The old name isn't kept, and the rename reaches further than it looks: posts,
 * diary entries and the decision log all read the name through a join, so every
 * place the pet is *labelled* updates at once.
 *
 * What doesn't change is prose that already contains the name — a diary entry, the
 * pet's own reasoning on a decision, a push that has already been sent. Those are
 * generated text, not a join, and rewriting them would be falsifying a record of
 * what was actually written. The rename sheet says so rather than leaving it to be
 * discovered.
 */
export async function PATCH(req: Request) {
  const { session, response } = await requireSession();
  if (response) return response;

  const parsed = renameSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_name" }, { status: 400 });

  const [updated] = await db
    .update(pets)
    .set({ name: parsed.data.name })
    .where(eq(pets.userId, session.user.id))
    .returning({ id: pets.id, name: pets.name });

  if (!updated) return NextResponse.json({ error: "no_pet" }, { status: 400 });
  return NextResponse.json({ pet: updated });
}

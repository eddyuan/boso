import { NextResponse } from "next/server";
import { petForUser, petState } from "@/lib/pet-mood";
import { requireSession } from "@/lib/session";

// The signed-in user's pet (one per user, created during onboarding via
// POST /api/me/onboarding/pet), with how it's feeling and what care is left.
export async function GET() {
  const { session, response } = await requireSession();
  if (response) return response;

  const pet = await petForUser(session.user.id);
  if (!pet) return NextResponse.json({ pet: null, mood: null, careToday: [] });

  const state = await petState(pet.id, session.user.id, pet.name);
  return NextResponse.json({ pet, ...state });
}

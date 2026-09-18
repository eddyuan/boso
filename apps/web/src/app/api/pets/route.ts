import { NextResponse } from "next/server";
import { db, pets } from "@bsocial/db";
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/session";

// The signed-in user's pet (one per user, created during onboarding via
// POST /api/me/onboarding/pet).
export async function GET() {
  const { session, response } = await requireSession();
  if (response) return response;

  const [pet] = await db.select().from(pets).where(eq(pets.userId, session.user.id));
  return NextResponse.json({ pet: pet ?? null });
}

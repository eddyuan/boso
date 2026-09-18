import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, pets, users } from "@bsocial/db";
import { requireSession } from "@/lib/session";
import { getOnboardingStatus } from "@/lib/onboarding";

// Admin-only: wipe the caller's own profile and pet so onboarding starts over
// (for testing the flow). Keeps the account, sign-in methods, verified
// email/phone, sessions, login history and admin status.
export async function POST() {
  const { session, response } = await requireSession({
    requireAdmin: true,
    allowIncompleteOnboarding: true,
    // An admin testing the under-18 path must be able to get back out.
    allowAgeRestricted: true,
  });
  if (response) return response;
  const userId = session.user.id;

  await db.transaction(async (tx) => {
    // Cascades to the pet's posts, likes, comments, follows and pet_actions.
    await tx.delete(pets).where(eq(pets.userId, userId));
    await tx
      .update(users)
      .set({
        termsVersion: null,
        termsAcceptedAt: null,
        birthday: null,
        ageGateFailedAt: null,
        gender: null,
        username: null,
        displayUsername: null,
        name: "",
        image: null,
        interests: [],
        notificationsPromptedAt: null,
        contactsPromptedAt: null,
        calendarPromptedAt: null,
        onboardingCompletedAt: null,
      })
      .where(eq(users.id, userId));
  });

  return NextResponse.json(await getOnboardingStatus(userId));
}

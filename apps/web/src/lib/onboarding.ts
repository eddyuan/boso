import { eq } from "drizzle-orm";
import { db, pets, users } from "@bsocial/db";
import {
  ONBOARDING_STEPS,
  getNextOnboardingStep,
  type OnboardingState,
  type OnboardingStep,
} from "@bsocial/shared";

export type OnboardingStatus = {
  state: OnboardingState;
  nextStep: OnboardingStep | null;
  completed: boolean;
  ageRestricted: boolean;
};

export async function getOnboardingStatus(userId: string): Promise<OnboardingStatus | null> {
  const [row] = await db
    .select({
      user: users,
      petId: pets.id,
    })
    .from(users)
    .leftJoin(pets, eq(pets.userId, users.id))
    .where(eq(users.id, userId));
  if (!row) return null;

  const u = row.user;
  const state: OnboardingState = {
    termsVersion: u.termsVersion,
    birthday: u.birthday,
    gender: u.gender,
    username: u.username,
    name: u.name,
    interests: u.interests,
    hasPet: !!row.petId,
    notificationsPromptedAt: u.notificationsPromptedAt?.toISOString() ?? null,
    contactsPromptedAt: u.contactsPromptedAt?.toISOString() ?? null,
    calendarPromptedAt: u.calendarPromptedAt?.toISOString() ?? null,
  };
  const nextStep = getNextOnboardingStep(state);

  // Stamp completion the first time every step is done. Kept on the user row
  // (and exposed on the session) so route guards don't recompute the steps.
  if (nextStep === null && !u.onboardingCompletedAt) {
    await db.update(users).set({ onboardingCompletedAt: new Date() }).where(eq(users.id, userId));
  }

  return {
    state,
    nextStep,
    completed: nextStep === null,
    ageRestricted: !!u.ageGateFailedAt,
  };
}

// Steps must be done in order (terms first, age gate before anything else),
// but a completed step can be submitted again to edit it during onboarding.
export function isStepAllowed(status: OnboardingStatus, step: OnboardingStep): boolean {
  if (status.nextStep === null) return true;
  return ONBOARDING_STEPS.indexOf(step) <= ONBOARDING_STEPS.indexOf(status.nextStep);
}

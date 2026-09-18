import {
  ONBOARDING_STEPS,
  type OnboardingState,
  type OnboardingStep,
} from '@bsocial/shared';
import { router } from 'expo-router';

import { ApiError, apiFetch } from '@/lib/api';
import { refreshSession } from '@/lib/auth-client';

export type OnboardingStatus = {
  state: OnboardingState;
  nextStep: OnboardingStep | null;
  completed: boolean;
  ageRestricted: boolean;
};

export function getOnboardingStatus() {
  return apiFetch<OnboardingStatus>('/api/me/onboarding');
}

// 1-based position for the progress bar.
export function stepNumber(step: OnboardingStep) {
  return { index: ONBOARDING_STEPS.indexOf(step) + 1, total: ONBOARDING_STEPS.length };
}

export function goToStep(step: OnboardingStep | null) {
  if (step) router.replace(`/onboarding/${step}`);
  // Finished (or age-restricted): the session now carries the flag, and the
  // root layout swaps to the right stack.
  else refreshSession();
}

// Submits a step and moves on. Returns an error code on failure.
export async function submitStep(step: OnboardingStep, body: object): Promise<string | null> {
  try {
    const status = await apiFetch<OnboardingStatus>(`/api/me/onboarding/${step}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    goToStep(status.nextStep);
    return null;
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.code === 'age_restricted') refreshSession();
      return e.code ?? 'request_failed';
    }
    return 'request_failed';
  }
}

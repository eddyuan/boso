import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getContactStatus } from "@bsocial/shared";
import { auth, type Session } from "@/lib/auth";
import { getClientIp } from "@/lib/request-meta";
import { recordActivity } from "@/lib/activity";

// Resolves the signed-in user for a route handler and records activity.
// Works for both the web (session cookie) and mobile (the Expo client
// forwards the cookie header).
export async function getSession(): Promise<Session | null> {
  const h = await headers();
  const result = await auth.api.getSession({ headers: h });
  if (!result) return null;

  await recordActivity({
    sessionId: result.session.id,
    sessionLastActiveAt: result.session.lastActiveAt,
    userId: result.user.id,
    ip: getClientIp(h),
  });

  return result;
}

type RequireSessionOptions = {
  // Account/contact management routes, so users can fix verification.
  allowUnverifiedContact?: boolean;
  // Onboarding routes themselves, plus account management.
  allowIncompleteOnboarding?: boolean;
  // Routes an age-restricted account may still use (e.g. reading its status).
  allowAgeRestricted?: boolean;
  // Admin-only routes (users.isAdmin).
  requireAdmin?: boolean;
};

type RequireSessionResult =
  | { session: Session; response?: never }
  | { session?: never; response: NextResponse };

function forbidden(error: string) {
  return { response: NextResponse.json({ error }, { status: 403 }) };
}

// Route guard. By default the user must be old enough, have a verified email
// or phone, and have finished onboarding.
export async function requireSession({
  allowUnverifiedContact = false,
  allowIncompleteOnboarding = false,
  allowAgeRestricted = false,
  requireAdmin = false,
}: RequireSessionOptions = {}): Promise<RequireSessionResult> {
  const session = await getSession();
  if (!session) {
    return { response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  if (!allowAgeRestricted && session.user.ageGateFailedAt) {
    return forbidden("age_restricted");
  }
  if (!allowUnverifiedContact && !getContactStatus(session.user).verified) {
    return forbidden("contact_verification_required");
  }
  if (!allowIncompleteOnboarding && !session.user.onboardingCompletedAt) {
    return forbidden("onboarding_required");
  }
  if (requireAdmin && !session.user.isAdmin) {
    return forbidden("admin_required");
  }
  return { session };
}

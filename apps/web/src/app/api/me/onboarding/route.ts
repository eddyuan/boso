import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { getOnboardingStatus } from "@/lib/onboarding";

// Current onboarding progress and the next step to show.
export async function GET() {
  const { session, response } = await requireSession({
    allowIncompleteOnboarding: true,
    allowAgeRestricted: true,
  });
  if (response) return response;

  const status = await getOnboardingStatus(session.user.id);
  if (!status) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(status);
}

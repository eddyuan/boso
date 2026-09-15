import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, sessions, users } from "@bsocial/db";
import { getContactStatus } from "@bsocial/shared";
import { auth, type Session } from "@/lib/auth";
import { getClientIp } from "@/lib/request-meta";

// Don't write activity on every request — once per window per device is plenty.
const ACTIVITY_WRITE_INTERVAL_MS = 5 * 60 * 1000;

// Resolves the signed-in user for a route handler and records activity.
// Works for both the web (session cookie) and mobile (the Expo client
// forwards the cookie header).
export async function getSession(): Promise<Session | null> {
  const h = await headers();
  const result = await auth.api.getSession({ headers: h });
  if (!result) return null;

  const lastActiveAt = result.session.lastActiveAt
    ? new Date(result.session.lastActiveAt).getTime()
    : 0;
  if (Date.now() - lastActiveAt > ACTIVITY_WRITE_INTERVAL_MS) {
    const now = new Date();
    const ip = getClientIp(h);
    await Promise.all([
      db
        .update(sessions)
        .set({ lastActiveAt: now, ...(ip ? { lastActiveIp: ip } : {}) })
        .where(eq(sessions.id, result.session.id)),
      db.update(users).set({ lastActiveAt: now }).where(eq(users.id, result.user.id)),
    ]);
  }

  return result;
}

type RequireSessionResult =
  | { session: Session; response?: never }
  | { session?: never; response: NextResponse };

// Route guard. By default the user must have a verified email or phone;
// account-management routes pass allowUnverifiedContact so users can fix that.
export async function requireSession(
  { allowUnverifiedContact = false }: { allowUnverifiedContact?: boolean } = {},
): Promise<RequireSessionResult> {
  const session = await getSession();
  if (!session) {
    return { response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  if (!allowUnverifiedContact && !getContactStatus(session.user).verified) {
    return {
      response: NextResponse.json(
        { error: "contact_verification_required" },
        { status: 403 },
      ),
    };
  }
  return { session };
}

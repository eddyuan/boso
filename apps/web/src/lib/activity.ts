import { eq } from "drizzle-orm";
import { db, sessions, users } from "@bsocial/db";

// Don't write activity on every request — once per window per device is plenty.
const ACTIVITY_WRITE_INTERVAL_MS = 5 * 60 * 1000;

// Records that the owner is active on this device (session + user). Throttled.
// Called from our API guard (lib/session.ts) and from Better Auth's
// /get-session (lib/auth.ts), which is what the app hits when it opens.
// users.lastActiveAt also decides whether the pet keeps acting
// (PET_OWNER_INACTIVE_DAYS).
export async function recordActivity({
  sessionId,
  sessionLastActiveAt,
  userId,
  ip,
}: {
  sessionId: string;
  sessionLastActiveAt: Date | string | null | undefined;
  userId: string;
  ip: string | null;
}) {
  const last = sessionLastActiveAt ? new Date(sessionLastActiveAt).getTime() : 0;
  if (Date.now() - last <= ACTIVITY_WRITE_INTERVAL_MS) return;

  const now = new Date();
  await Promise.all([
    db
      .update(sessions)
      .set({ lastActiveAt: now, ...(ip ? { lastActiveIp: ip } : {}) })
      .where(eq(sessions.id, sessionId)),
    db.update(users).set({ lastActiveAt: now }).where(eq(users.id, userId)),
  ]);
}

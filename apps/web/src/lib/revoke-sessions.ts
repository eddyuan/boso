import type { SQL } from "drizzle-orm";
import { db, sessions, authEvents } from "@bsocial/db";

// Deletes matching sessions and records a `session_revoked` event for each,
// in one transaction. Returns the number of sessions revoked.
export async function revokeSessions(where: SQL): Promise<number> {
  return db.transaction(async (tx) => {
    const deleted = await tx.delete(sessions).where(where).returning();
    if (deleted.length > 0) {
      await tx.insert(authEvents).values(
        deleted.map((s) => ({
          userId: s.userId,
          sessionId: s.id,
          type: "session_revoked" as const,
          ipAddress: s.lastActiveIp ?? s.ipAddress,
          userAgent: s.userAgent,
          deviceName: s.deviceName,
        })),
      );
    }
    return deleted.length;
  });
}

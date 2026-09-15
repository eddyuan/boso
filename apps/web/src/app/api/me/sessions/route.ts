import { NextResponse } from "next/server";
import { and, desc, eq, gt, ne } from "drizzle-orm";
import { db, sessions } from "@bsocial/db";
import { requireSession } from "@/lib/session";
import { revokeSessions } from "@/lib/revoke-sessions";

// Signed-in devices for the current user. Session tokens are never returned.
export async function GET() {
  const { session: current, response } = await requireSession({ allowUnverifiedContact: true });
  if (response) return response;

  const rows = await db
    .select({
      id: sessions.id,
      deviceName: sessions.deviceName,
      userAgent: sessions.userAgent,
      ipAddress: sessions.ipAddress,
      lastActiveAt: sessions.lastActiveAt,
      lastActiveIp: sessions.lastActiveIp,
      createdAt: sessions.createdAt,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .where(and(eq(sessions.userId, current.user.id), gt(sessions.expiresAt, new Date())))
    .orderBy(desc(sessions.lastActiveAt));

  return NextResponse.json({
    sessions: rows.map((s) => ({ ...s, current: s.id === current.session.id })),
  });
}

// Sign out every other device.
export async function DELETE() {
  const { session: current, response } = await requireSession({ allowUnverifiedContact: true });
  if (response) return response;

  const revoked = await revokeSessions(
    and(eq(sessions.userId, current.user.id), ne(sessions.id, current.session.id))!,
  );
  return NextResponse.json({ revoked });
}

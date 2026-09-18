import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, sessions } from "@bsocial/db";
import { requireSession } from "@/lib/session";
import { revokeSessions } from "@/lib/revoke-sessions";

// Sign out one specific device. Scoped to the caller's own sessions.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session: current, response } = await requireSession({ allowUnverifiedContact: true, allowIncompleteOnboarding: true });
  if (response) return response;

  const { id } = await params;
  const revoked = await revokeSessions(
    and(eq(sessions.userId, current.user.id), eq(sessions.id, id))!,
  );
  if (revoked === 0) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({ revoked, signedOutCurrentDevice: id === current.session.id });
}

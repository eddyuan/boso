import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, accounts, authEvents } from "@bsocial/db";
import { getClientIp, getDeviceName } from "@/lib/request-meta";
import { requireSession } from "@/lib/session";
import { getAccountOverview } from "@/lib/sign-in-methods";

const UNLINKABLE = new Set(["google", "apple"]);

// Unlink Google or Apple. Replaces Better Auth's /unlink-account, which
// requires a session created in the last 24h — unusable with 1-year sessions.
export async function DELETE(req: Request, { params }: { params: Promise<{ providerId: string }> }) {
  const { session, response } = await requireSession({ allowUnverifiedContact: true, allowIncompleteOnboarding: true });
  if (response) return response;

  const { providerId } = await params;
  if (!UNLINKABLE.has(providerId)) {
    return NextResponse.json({ error: "unsupported_provider" }, { status: 400 });
  }

  const overview = await getAccountOverview(session.user.id);
  if (!overview?.linked.some((l) => l.providerId === providerId)) {
    return NextResponse.json({ error: "not_linked" }, { status: 404 });
  }
  // Never leave the user without a way back in.
  if (overview.methods.filter((m) => m !== providerId).length === 0) {
    return NextResponse.json({ error: "last_sign_in_method" }, { status: 409 });
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(accounts)
      .where(and(eq(accounts.userId, session.user.id), eq(accounts.providerId, providerId)));
    await tx.insert(authEvents).values({
      userId: session.user.id,
      sessionId: session.session.id,
      type: "account_unlinked",
      ipAddress: getClientIp(req.headers),
      userAgent: req.headers.get("user-agent"),
      deviceName: session.session.deviceName ?? null,
      metadata: { providerId },
    });
  });

  return NextResponse.json(await getAccountOverview(session.user.id));
}

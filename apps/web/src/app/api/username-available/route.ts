import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { db, users } from "@bsocial/db";
import { normalizeUsername, validateUsername } from "@bsocial/shared";
import { requireSession } from "@/lib/session";

// Live nickname check for the onboarding/profile screens. Signed-in only, to
// keep it from being an anonymous username-enumeration endpoint.
export async function GET(req: Request) {
  const { session, response } = await requireSession({ allowIncompleteOnboarding: true });
  if (response) return response;

  const raw = new URL(req.url).searchParams.get("username") ?? "";
  const invalid = validateUsername(raw);
  if (invalid) return NextResponse.json({ available: false, reason: invalid });

  const [taken] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.username, normalizeUsername(raw)), ne(users.id, session.user.id)));

  return NextResponse.json(taken ? { available: false, reason: "taken" } : { available: true });
}

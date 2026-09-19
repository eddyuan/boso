import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, users } from "@bsocial/db";
import { requireSession } from "@/lib/session";
import { getAccountOverview } from "@/lib/sign-in-methods";

// Contact status and linked sign-in methods for the account settings screen.
export async function GET() {
  const { session, response } = await requireSession({ allowUnverifiedContact: true, allowIncompleteOnboarding: true });
  if (response) return response;

  const overview = await getAccountOverview(session.user.id);
  if (!overview) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(overview);
}

const preferencesSchema = z.object({
  /**
   * Opt-in to seeing `sensitive` posts uncovered. Off by default and never
   * prompted for — it lives in profile settings for people who go looking.
   */
  showSensitiveContent: z.boolean(),
});

export async function PATCH(req: Request) {
  const { session, response } = await requireSession();
  if (response) return response;

  const body = await req.json().catch(() => null);
  const parsed = preferencesSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  await db
    .update(users)
    .set({ showSensitiveContent: parsed.data.showSensitiveContent })
    .where(eq(users.id, session.user.id));

  return NextResponse.json({ showSensitiveContent: parsed.data.showSensitiveContent });
}

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, users } from "@bsocial/db";
import { LOCALES, type Locale } from "@bsocial/shared";
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

const preferencesSchema = z
  .object({
    /**
     * Opt-in to seeing `sensitive` posts uncovered. Off by default and never
     * prompted for — it lives in profile settings for people who go looking.
     */
    showSensitiveContent: z.boolean().optional(),
    /**
     * The chosen UI language. `null` means follow the device, which is different
     * from "English": someone who never opens the picker should keep tracking
     * their phone when they change its language or when we add their language.
     */
    locale: z
      .enum(LOCALES.map((l) => l.code) as [Locale, ...Locale[]])
      .nullable()
      .optional(),
  })
  // Both fields are optional so either can be set alone, which leaves `{}` as a
  // request that would silently do nothing. Rejected rather than accepted.
  .refine((v) => Object.keys(v).length > 0, { message: "nothing_to_update" });

export async function PATCH(req: Request) {
  const { session, response } = await requireSession();
  if (response) return response;

  const body = await req.json().catch(() => null);
  const parsed = preferencesSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  // Only the keys that were actually sent, so a PATCH of one preference can't
  // reset the other to its default.
  const patch: Partial<{ showSensitiveContent: boolean; locale: string | null }> = {};
  if (parsed.data.showSensitiveContent !== undefined) {
    patch.showSensitiveContent = parsed.data.showSensitiveContent;
  }
  if (parsed.data.locale !== undefined) patch.locale = parsed.data.locale;

  await db.update(users).set(patch).where(eq(users.id, session.user.id));

  return NextResponse.json(patch);
}

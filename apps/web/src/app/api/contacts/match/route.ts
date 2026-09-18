import { NextResponse } from "next/server";
import { and, eq, inArray, isNotNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db, users } from "@bsocial/db";
import { requireSession } from "@/lib/session";

const sha256Hex = z.string().regex(/^[0-9a-f]{64}$/);
const MAX_HASHES = 2000;

const bodySchema = z.object({
  // SHA-256 of E.164 phone numbers and lowercased emails, hashed on-device.
  phoneHashes: z.array(sha256Hex).max(MAX_HASHES).default([]),
  emailHashes: z.array(sha256Hex).max(MAX_HASHES).default([]),
});

// "Find friends": match hashed contacts against verified phones/emails of
// onboarded users. The uploaded hashes are used for this query only and are
// never stored.
export async function POST(req: Request) {
  const { session, response } = await requireSession({ allowIncompleteOnboarding: true });
  if (response) return response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const { phoneHashes, emailHashes } = parsed.data;
  if (phoneHashes.length === 0 && emailHashes.length === 0) return NextResponse.json({ matches: [] });

  // Postgres' built-in sha256() over the stored (normalized) values.
  const phoneHash = sql`encode(sha256(convert_to(${users.phoneNumber}, 'UTF8')), 'hex')`;
  const emailHash = sql`encode(sha256(convert_to(lower(${users.email}), 'UTF8')), 'hex')`;
  const conditions = [
    phoneHashes.length > 0 ? and(eq(users.phoneNumberVerified, true), inArray(phoneHash, phoneHashes)) : undefined,
    emailHashes.length > 0 ? and(eq(users.emailVerified, true), inArray(emailHash, emailHashes)) : undefined,
  ];

  const matches = await db
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
      image: users.image,
    })
    .from(users)
    .where(
      and(
        ne(users.id, session.user.id),
        isNotNull(users.onboardingCompletedAt),
        sql`${users.ageGateFailedAt} is null`,
        or(...conditions),
      ),
    )
    .limit(200);

  return NextResponse.json({ matches });
}

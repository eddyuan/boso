import { eq } from "drizzle-orm";
import { db, accounts, users } from "@bsocial/db";
import { getContactStatus } from "@bsocial/shared";

export type SignInMethod = "password" | "google" | "apple" | "phone";

// Everything the account settings screen needs: contact status plus the ways
// this user can currently sign in.
export async function getAccountOverview(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return null;

  const rows = await db
    .select({ providerId: accounts.providerId, createdAt: accounts.createdAt })
    .from(accounts)
    .where(eq(accounts.userId, userId));

  const linked = rows.map((r) => ({
    method: (r.providerId === "credential" ? "password" : r.providerId) as SignInMethod,
    providerId: r.providerId,
    linkedAt: r.createdAt,
  }));

  const contact = getContactStatus(user);
  // A verified phone is a sign-in method on its own (SMS code login).
  const methods: SignInMethod[] = [
    ...linked.map((l) => l.method),
    ...(contact.phoneVerified ? (["phone"] as const) : []),
  ];

  return {
    email: contact.hasRealEmail ? user.email : null,
    emailVerified: contact.emailVerified,
    phoneNumber: user.phoneNumber,
    phoneVerified: contact.phoneVerified,
    contactVerified: contact.verified,
    linked,
    methods,
  };
}

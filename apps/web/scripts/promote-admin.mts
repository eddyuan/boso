/**
 * Promote a user to admin.
 *
 *   tsx scripts/promote-admin.mts <email>
 */
import "./lib/load-env.mjs";
import { eq } from "drizzle-orm";
import { db, users } from "@bsocial/db";

const email = process.argv[2];
if (!email) {
  console.error("usage: tsx scripts/promote-admin.mts <email>");
  process.exit(1);
}

const [user] = await db.select({ id: users.id, name: users.name, email: users.email, isAdmin: users.isAdmin }).from(users).where(eq(users.email, email));

if (!user) {
  console.error(`no user found with email: ${email}`);
  process.exit(1);
}

if (user.isAdmin) {
  console.log(`${user.name} (${user.email}) is already an admin`);
  process.exit(0);
}

await db.update(users).set({ isAdmin: true }).where(eq(users.id, user.id));
console.log(`promoted ${user.name} (${user.email}) to admin`);

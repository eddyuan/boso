import { NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, accounts, pets, posts, users } from "@bsocial/db";
import { requireSession } from "@/lib/session";
import { hashPassword } from "better-auth/crypto";

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 1000;

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  search: z.string().optional(),
  mock: z.enum(["all", "only", "exclude"]).default("all"),
});

export async function GET(req: Request) {
  try {
  const { session, response } = await requireSession({ requireAdmin: true });
  if (response) return response;
  void session;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "invalid_query" }, { status: 400 });

  const { page, pageSize, search, mock } = parsed.data;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (mock === "only") conditions.push(eq(users.isMock, true));
  if (mock === "exclude") conditions.push(eq(users.isMock, false));
  if (search) {
    const q = `%${search}%`;
    conditions.push(
      sql`(${users.name} ilike ${q} or ${users.email} ilike ${q} or ${users.username} ilike ${q})`,
    );
  }

  const where = conditions.length ? sql.join(conditions, sql` and `) : sql`true`;

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        username: users.username,
        image: users.image,
        isMock: users.isMock,
        isAdmin: users.isAdmin,
        createdAt: users.createdAt,
        lastActiveAt: users.lastActiveAt,
        petName: pets.name,
        petSpecies: pets.species,
        postCount: sql<number>`(select count(*) from ${posts} inner join ${pets} p on ${posts.petId} = p.id where p.user_id = ${users.id})`.mapWith(Number),
        hasCredential: sql<boolean>`(select exists(select 1 from ${accounts} where ${accounts.userId} = ${users.id} and ${accounts.providerId} = 'credential'))`.mapWith(Boolean),
      })
      .from(users)
      .leftJoin(pets, eq(pets.userId, users.id))
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(users)
      .where(where),
  ]);

  return NextResponse.json({
    users: rows,
    total: totalRow[0]?.count ?? 0,
    page,
    pageSize,
  });
  } catch (err) {
    console.error("[admin/users] GET error:", err);
    return NextResponse.json({ error: "internal_error", message: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

const patchSchema = z.object({
  userId: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function PATCH(req: Request) {
  const { session, response } = await requireSession({ requireAdmin: true });
  if (response) return response;
  void session;

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const { userId, newPassword } = parsed.data;

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) return NextResponse.json({ error: "user_not_found" }, { status: 404 });

  const credentialAccount = await db.query.accounts.findFirst({
    where: and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")),
  });

  const hashed = await hashPassword(newPassword);

  if (credentialAccount) {
    await db.update(accounts).set({ password: hashed, accountId: user.id }).where(eq(accounts.id, credentialAccount.id));
  } else {
    await db.insert(accounts).values({
      id: crypto.randomUUID(),
      accountId: user.id,
      providerId: "credential",
      userId: user.id,
      password: hashed,
    });
  }

  return NextResponse.json({ ok: true });
}

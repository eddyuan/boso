import { NextResponse } from "next/server";
import { z } from "zod";
import { desc, eq, sql } from "drizzle-orm";
import { db, petActions, pets, users } from "@bsocial/db";
import { executeAction, type PetAction } from "@/lib/actions";
import { requireSession } from "@/lib/session";

const PAGE_SIZE = 50;

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  type: z.enum(["all", "post", "like", "comment", "follow", "visit", "none"]).default("all"),
  status: z.enum(["all", "pending", "approved", "rejected", "executed", "failed"]).default("all"),
  search: z.string().optional(),
});

export async function GET(req: Request) {
  const { session, response } = await requireSession({ requireAdmin: true });
  if (response) return response;
  void session;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "invalid_query" }, { status: 400 });

  const { page, type, status, search } = parsed.data;
  const offset = (page - 1) * PAGE_SIZE;

  const conditions = [];
  if (type !== "all") conditions.push(eq(petActions.type, type));
  if (status !== "all") conditions.push(eq(petActions.status, status));
  if (search) {
    const q = `%${search}%`;
    conditions.push(sql`(${pets.name} ilike ${q} or ${users.name} ilike ${q} or ${petActions.reasoning} ilike ${q})`);
  }
  const where = conditions.length ? sql.join(conditions, sql` and `) : sql`true`;

  const [rows, totalRow, counts] = await Promise.all([
    db
      .select({
        id: petActions.id,
        type: petActions.type,
        status: petActions.status,
        payload: petActions.payload,
        reasoning: petActions.reasoning,
        createdAt: petActions.createdAt,
        executedAt: petActions.executedAt,
        petId: pets.id,
        petName: pets.name,
        petSpecies: pets.species,
        autoApprove: pets.autoApprove,
        ownerId: users.id,
        ownerName: users.name,
        ownerIsMock: users.isMock,
      })
      .from(petActions)
      .innerJoin(pets, eq(pets.id, petActions.petId))
      .innerJoin(users, eq(users.id, pets.userId))
      .where(where)
      .orderBy(desc(petActions.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(petActions)
      .innerJoin(pets, eq(pets.id, petActions.petId))
      .innerJoin(users, eq(users.id, pets.userId))
      .where(where),
    // Unfiltered status tallies, so the header always shows the real backlog.
    db
      .select({ status: petActions.status, count: sql<number>`count(*)`.mapWith(Number) })
      .from(petActions)
      .groupBy(petActions.status),
  ]);

  return NextResponse.json({
    actions: rows,
    total: totalRow[0]?.count ?? 0,
    counts: Object.fromEntries(counts.map((c) => [c.status, c.count])),
    page,
    pageSize: PAGE_SIZE,
  });
}

const patchSchema = z.object({
  id: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
});

/** Approve carries the pending decision out for real; reject just closes it. */
export async function PATCH(req: Request) {
  const { session, response } = await requireSession({ requireAdmin: true });
  if (response) return response;
  void session;

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const { id, decision } = parsed.data;

  const [action] = await db.select().from(petActions).where(eq(petActions.id, id));
  if (!action) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (action.status !== "pending") {
    return NextResponse.json({ error: "not_pending", status: action.status }, { status: 409 });
  }

  if (decision === "reject") {
    await db.update(petActions).set({ status: "rejected" }).where(eq(petActions.id, id));
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  // The row stores the decision minus its discriminator, so rebuild it.
  const petAction = {
    action: action.type,
    reasoning: action.reasoning ?? "",
    ...(action.payload as Record<string, unknown>),
  } as PetAction;

  try {
    await executeAction(action.petId, petAction);
  } catch (error) {
    await db.update(petActions).set({ status: "failed" }).where(eq(petActions.id, id));
    console.error("[admin/pet-actions] execute failed:", error);
    return NextResponse.json({ error: "execute_failed" }, { status: 500 });
  }

  await db.update(petActions).set({ status: "executed", executedAt: new Date() }).where(eq(petActions.id, id));
  return NextResponse.json({ ok: true, status: "executed" });
}

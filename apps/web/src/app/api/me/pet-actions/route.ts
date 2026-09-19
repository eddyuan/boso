import { NextResponse } from "next/server";
import { and, desc, eq, ne } from "drizzle-orm";
import { db, petActions, pets } from "@bsocial/db";
import { z } from "zod";
import { executeAction, type PetAction } from "@/lib/actions";
import { awardXp } from "@/lib/bond";
import { requireSession } from "@/lib/session";

// What your pet has been up to: the activity tab and the approvals queue.
export async function GET(req: Request) {
  const { session, response } = await requireSession();
  if (response) return response;

  const [pet] = await db.select({ id: pets.id }).from(pets).where(eq(pets.userId, session.user.id));
  if (!pet) return NextResponse.json({ actions: [], pendingCount: 0 });

  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit")) || 50, 200);
  const actions = await db
    .select({
      id: petActions.id,
      type: petActions.type,
      status: petActions.status,
      payload: petActions.payload,
      reasoning: petActions.reasoning,
      createdAt: petActions.createdAt,
      executedAt: petActions.executedAt,
    })
    .from(petActions)
    // "none" decisions are bookkeeping, not activity worth showing.
    .where(and(eq(petActions.petId, pet.id), ne(petActions.type, "none")))
    .orderBy(desc(petActions.createdAt))
    .limit(limit);

  return NextResponse.json({
    actions,
    pendingCount: actions.filter((a) => a.status === "pending").length,
  });
}

const patchSchema = z.object({
  id: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
});

/**
 * Answering what your pet asked. "Ask me first" has been a dead end until now:
 * pending decisions accumulated and counted against the daily budget with no
 * way to say yes.
 *
 * Mirrors the admin handler, with one difference that matters — it only ever
 * touches decisions belonging to the caller's own pet.
 */
export async function PATCH(req: Request) {
  const { session, response } = await requireSession();
  if (response) return response;

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { id, decision } = parsed.data;

  const [pet] = await db.select({ id: pets.id }).from(pets).where(eq(pets.userId, session.user.id));
  if (!pet) return NextResponse.json({ error: "no_pet" }, { status: 400 });

  // Scoped to this pet, so one account can never answer another's decisions.
  const [action] = await db
    .select()
    .from(petActions)
    .where(and(eq(petActions.id, id), eq(petActions.petId, pet.id)));
  if (!action) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (action.status !== "pending") {
    return NextResponse.json({ error: "not_pending", status: action.status }, { status: 409 });
  }

  if (decision === "reject") {
    await db.update(petActions).set({ status: "rejected" }).where(eq(petActions.id, id));
    // Saying no is answering too — paying only for "yes" would buy consent.
    const bond = await awardXp(pet.id, "answer_ask");
    return NextResponse.json({ ok: true, status: "rejected", bond });
  }

  // The row stores the decision minus its discriminator, so rebuild it.
  const petAction = {
    action: action.type,
    reasoning: action.reasoning ?? "",
    ...(action.payload as Record<string, unknown>),
  } as PetAction;

  try {
    await executeAction(pet.id, petAction);
  } catch (error) {
    await db.update(petActions).set({ status: "failed" }).where(eq(petActions.id, id));
    console.error("[me/pet-actions] execute failed:", error);
    return NextResponse.json({ error: "execute_failed" }, { status: 500 });
  }

  await db.update(petActions).set({ status: "executed", executedAt: new Date() }).where(eq(petActions.id, id));
  // Answering is the trust ritual and the most distinctive thing here, so it's
  // the biggest single award in the economy.
  const bond = await awardXp(pet.id, "answer_ask");
  return NextResponse.json({ ok: true, status: "executed", bond });
}

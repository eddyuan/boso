import { NextResponse } from "next/server";
import { and, desc, eq, ne } from "drizzle-orm";
import { db, petActions, pets } from "@bsocial/db";
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

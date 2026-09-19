import { NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { db, petTreasures, pets, places } from "@bsocial/db";
import { requireSession } from "@/lib/session";

/** The shelf: everything the pet has brought home, newest first. */
export async function GET() {
  const { session, response } = await requireSession();
  if (response) return response;

  const [pet] = await db.select({ id: pets.id }).from(pets).where(eq(pets.userId, session.user.id));
  if (!pet) return NextResponse.json({ treasures: [], counts: {} });

  const [rows, totals] = await Promise.all([
    db
      .select({
        id: petTreasures.id,
        kind: petTreasures.kind,
        foundAt: petTreasures.foundAt,
        placeName: places.name,
      })
      .from(petTreasures)
      .leftJoin(places, eq(places.id, petTreasures.placeId))
      .where(eq(petTreasures.petId, pet.id))
      .orderBy(desc(petTreasures.foundAt))
      .limit(100),
    db
      .select({ kind: petTreasures.kind, count: sql<number>`count(*)`.mapWith(Number) })
      .from(petTreasures)
      .where(eq(petTreasures.petId, pet.id))
      .groupBy(petTreasures.kind),
  ]);

  return NextResponse.json({
    treasures: rows,
    counts: Object.fromEntries(totals.map((t) => [t.kind, t.count])),
  });
}

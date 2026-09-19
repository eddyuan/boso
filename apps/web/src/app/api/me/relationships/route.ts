import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, pets } from "@bsocial/db";
import { relationshipsFor } from "@/lib/relationships";
import { requireSession } from "@/lib/session";

/** Who your pet is closest to, strongest first, with decay already applied. */
export async function GET() {
  const { session, response } = await requireSession();
  if (response) return response;

  const [pet] = await db.select({ id: pets.id }).from(pets).where(eq(pets.userId, session.user.id));
  if (!pet) return NextResponse.json({ relationships: [] });

  const relationships = await relationshipsFor(pet.id, 12);
  return NextResponse.json({
    relationships: relationships.map((r) => ({
      petId: r.otherPetId,
      petName: r.petName,
      species: r.species,
      ownerName: r.ownerName,
      ownerImage: r.ownerImage,
      affinity: Math.round(r.affinity * 10) / 10,
      tier: r.tier.id,
      tierLabel: r.tier.label,
      blurb: r.tier.blurb,
      interactions: r.interactions,
      becameFriendsAt: r.becameFriendsAt,
    })),
  });
}

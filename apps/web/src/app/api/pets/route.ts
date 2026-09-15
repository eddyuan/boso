import { NextResponse } from "next/server";
import { z } from "zod";
import { db, pets } from "@bsocial/db";
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/session";

const createPetSchema = z.object({
  name: z.string().min(1).max(40),
  personality: z.string().max(500).optional(),
});

export async function GET() {
  const { session, response } = await requireSession();
  if (response) return response;

  const ownPets = await db.select().from(pets).where(eq(pets.userId, session.user.id));
  return NextResponse.json({ pets: ownPets });
}

export async function POST(req: Request) {
  const { session, response } = await requireSession();
  if (response) return response;

  const parsed = createPetSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [pet] = await db
    .insert(pets)
    .values({
      userId: session.user.id,
      name: parsed.data.name,
      personality: parsed.data.personality ?? "",
    })
    .returning();

  return NextResponse.json({ pet }, { status: 201 });
}

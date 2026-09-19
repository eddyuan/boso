import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db, petDiary, pets } from "@bsocial/db";
import { awardXpOncePerDay } from "@/lib/bond";
import { requireSession } from "@/lib/session";

/** Your pet's diary, newest first. Written nightly by inngest/diary.ts. */
export async function GET(req: Request) {
  const { session, response } = await requireSession();
  if (response) return response;

  const [pet] = await db.select({ id: pets.id }).from(pets).where(eq(pets.userId, session.user.id));
  if (!pet) return NextResponse.json({ entries: [] });

  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit")) || 14, 60);
  const entries = await db
    .select({
      id: petDiary.id,
      day: petDiary.day,
      entry: petDiary.entry,
      stats: petDiary.stats,
      moodScore: petDiary.moodScore,
    })
    .from(petDiary)
    .where(eq(petDiary.petId, pet.id))
    .orderBy(desc(petDiary.day))
    .limit(limit);

  // Reading last night's entry is the ritual the bond pays for, so it's
  // credited here rather than needing a separate "mark read" call the client
  // could forget to make. Once a day: opening it twice isn't twice the ritual.
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  if (entries.some((e) => e.day === yesterday)) {
    void awardXpOncePerDay(pet.id, "read_diary").catch((error) =>
      console.error("[diary] read award failed:", error),
    );
  }

  return NextResponse.json({ entries });
}

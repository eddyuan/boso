import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, mockProfiles } from "@bsocial/db";
import { generateMockPost, petForMockUser } from "@/lib/mock-poster";
import { localeFor } from "@/lib/locale";
import { requireSession } from "@/lib/session";

/** Preview a post in a persona's voice, for the admin compose dialog. */
export async function POST(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { session, response } = await requireSession({ requireAdmin: true });
  if (response) return response;
  void session;

  const { userId } = await params;

  const [profile] = await db.select().from(mockProfiles).where(eq(mockProfiles.userId, userId));
  if (!profile) return NextResponse.json({ error: "no_mock_profile" }, { status: 404 });

  const pet = await petForMockUser(userId);
  if (!pet) return NextResponse.json({ error: "no_pet" }, { status: 404 });

  try {
    // Shared with the scheduled poster, so a preview sounds like the real thing.
    const { content, images } = await generateMockPost(profile, pet, {
      imageCount: 1 + Math.floor(Math.random() * 4),
      locale: await localeFor(userId),
    });
    return NextResponse.json({ content, petId: pet.id, images });
  } catch (error) {
    if ((error as Error).message === "empty_generation") {
      return NextResponse.json({ error: "empty_generation" }, { status: 500 });
    }
    throw error;
  }
}

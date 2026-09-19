import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, pets, users, whiskers } from "@bsocial/db";
import { enoughToTalkAbout, gatherLocalNews, writeWhiskersLine } from "@/lib/whiskers";
import { requireSession } from "@/lib/session";

const querySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
});

/**
 * Today's line of local gossip, generated once and cached for the day — it's
 * the same news all day, and regenerating on every app open would both cost a
 * model call each time and let the story change under someone mid-morning.
 */
export async function GET(req: Request) {
  const { session, response } = await requireSession();
  if (response) return response;

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "invalid_query" }, { status: 400 });

  const day = new Date().toISOString().slice(0, 10);

  const [cached] = await db
    .select({ line: whiskers.line, sourcePostIds: whiskers.sourcePostIds })
    .from(whiskers)
    .where(and(eq(whiskers.userId, session.user.id), eq(whiskers.day, day)));
  if (cached) return NextResponse.json({ whiskers: cached });

  const [pet] = await db.select({ name: pets.name }).from(pets).where(eq(pets.userId, session.user.id));
  if (!pet) return NextResponse.json({ whiskers: null });

  // Prefer the caller's live position; fall back to the last one we recorded.
  let { latitude, longitude } = parsed.data;
  if (latitude === undefined || longitude === undefined) {
    const [stored] = await db
      .select({ latitude: users.lastLatitude, longitude: users.lastLongitude })
      .from(users)
      .where(eq(users.id, session.user.id));
    latitude = stored?.latitude ?? undefined;
    longitude = stored?.longitude ?? undefined;
  }
  if (latitude === undefined || longitude === undefined) return NextResponse.json({ whiskers: null });

  const sources = await gatherLocalNews(session.user.id, latitude, longitude);
  // No line at all beats an invented one: the first time someone taps through
  // to nothing, the feature stops being worth reading.
  if (!enoughToTalkAbout(sources)) return NextResponse.json({ whiskers: null });

  const line = await writeWhiskersLine(pet.name, sources);
  if (!line) return NextResponse.json({ whiskers: null });

  const sourcePostIds = sources.map((s) => s.id);
  await db
    .insert(whiskers)
    .values({ userId: session.user.id, day, line, sourcePostIds })
    .onConflictDoNothing();

  return NextResponse.json({ whiskers: { line, sourcePostIds } });
}

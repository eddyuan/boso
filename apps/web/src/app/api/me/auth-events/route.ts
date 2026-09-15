import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db, authEvents } from "@bsocial/db";
import { requireSession } from "@/lib/session";

// Login history for the current user (most recent first).
export async function GET(req: Request) {
  const { session: current, response } = await requireSession({ allowUnverifiedContact: true });
  if (response) return response;

  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit")) || 50, 200);
  const events = await db
    .select()
    .from(authEvents)
    .where(eq(authEvents.userId, current.user.id))
    .orderBy(desc(authEvents.createdAt))
    .limit(limit);

  return NextResponse.json({ events });
}

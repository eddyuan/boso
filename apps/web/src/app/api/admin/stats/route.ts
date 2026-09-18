import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db, pets, places, posts, users } from "@bsocial/db";
import { requireSession } from "@/lib/session";

export async function GET() {
  const { session, response } = await requireSession({ requireAdmin: true });
  if (response) return response;
  void session;

  const [stats] = await db
    .select({
      users: sql<number>`count(*)`.mapWith(Number),
      mockUsers: sql<number>`count(*) filter (where ${users.isMock} = true)`.mapWith(Number),
      posts: sql<number>`(select count(*) from ${posts})`.mapWith(Number),
      postsWithImages: sql<number>`(select count(distinct post_id) from post_media)`.mapWith(Number),
      places: sql<number>`(select count(*) from ${places})`.mapWith(Number),
      pets: sql<number>`(select count(*) from ${pets})`.mapWith(Number),
    })
    .from(users)
    .limit(1);

  return NextResponse.json(stats);
}

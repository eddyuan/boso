import { NextResponse } from "next/server";
import { and, desc, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db, postTopics, topics } from "@bsocial/db";
import { requireSession } from "@/lib/session";

/**
 * Topics worth offering as a filter.
 *
 * Ranked by recent use rather than all-time `postCount`, because a filter is
 * only useful if selecting it returns something. An all-time ranking would
 * surface whatever was popular months ago and hand back an empty feed — the
 * fastest way to make filters feel broken.
 *
 * Hidden topics and aliases are excluded: an alias would duplicate its
 * canonical topic in the list and then filter on a slug nothing is tagged with.
 */

const RECENT_DAYS = 14;

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export async function GET(req: Request) {
  const { response } = await requireSession();
  if (response) return response;

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "invalid_query" }, { status: 400 });

  const since = new Date(Date.now() - RECENT_DAYS * 86_400_000);

  const rows = await db
    .select({
      slug: topics.slug,
      label: topics.label,
      interest: topics.interest,
      recent: sql<number>`count(${postTopics.postId})`.mapWith(Number),
    })
    .from(topics)
    .innerJoin(postTopics, sql`${postTopics.topic} = ${topics.slug} and ${postTopics.createdAt} > ${since.toISOString()}`)
    .where(and(ne(topics.status, "hidden"), isNull(topics.aliasOf)))
    .groupBy(topics.slug, topics.label, topics.interest)
    .orderBy(desc(sql`count(${postTopics.postId})`))
    .limit(parsed.data.limit);

  return NextResponse.json({ topics: rows, windowDays: RECENT_DAYS });
}

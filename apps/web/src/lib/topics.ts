import { and, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { db, postTopics, topics, userTopics } from "@bsocial/db";
import {
  INTERESTS,
  TOPIC_PROMOTION_THRESHOLD,
  decayedScore,
  normalizeTopicSlug,
  topicLabelFromSlug,
} from "@bsocial/shared";

const INTEREST_VALUES = INTERESTS.map((i) => i.value) as string[];

/** Candidate vocabulary handed to the classifier so it reuses what exists. */
export async function knownTopicSlugs(limit = 120): Promise<string[]> {
  const rows = await db
    .select({ slug: topics.slug })
    .from(topics)
    .where(and(ne(topics.status, "hidden"), isNull(topics.aliasOf)))
    .orderBy(desc(topics.postCount))
    .limit(limit);
  return rows.map((r) => r.slug);
}

/**
 * Follows an alias chain to the topic that should actually be counted.
 *
 * Exported because filtering needs it too: a topic slug held by a client from
 * before an admin merged two topics must still return the posts it used to,
 * rather than silently matching nothing.
 */
export async function resolveAlias(slug: string): Promise<string> {
  let current = slug;
  for (let i = 0; i < 5; i++) {
    const [row] = await db.select({ aliasOf: topics.aliasOf }).from(topics).where(eq(topics.slug, current));
    if (!row?.aliasOf) return current;
    current = row.aliasOf;
  }
  return current;
}

export type ClassifiedTopic = { slug: string; label: string; interest: string; confidence: number };

/**
 * Attaches a post's topics, creating any that are new. Every slug is normalized
 * first, so the same concept can't enter twice as "cafés" and "coffee"; a topic
 * that resolves to an alias is counted against its canonical row instead.
 */
export async function attachPostTopics(postId: string, classified: ClassifiedTopic[]): Promise<string[]> {
  const attached: string[] = [];

  for (const t of classified) {
    const slug = normalizeTopicSlug(t.slug);
    if (!slug) continue;
    // An unknown parent would orphan the topic from interest matching entirely.
    const interest = INTEREST_VALUES.includes(t.interest) ? t.interest : null;
    if (!interest) continue;

    await db
      .insert(topics)
      .values({ slug, label: t.label?.trim() || topicLabelFromSlug(slug), interest })
      .onConflictDoNothing();

    const canonical = await resolveAlias(slug);
    if (attached.includes(canonical)) continue;

    const inserted = await db
      .insert(postTopics)
      .values({ postId, topic: canonical, confidence: t.confidence })
      .onConflictDoNothing()
      .returning({ topic: postTopics.topic });

    // Only a genuinely new pairing moves popularity, so re-classifying a post
    // can't inflate it.
    if (inserted.length > 0) {
      await db
        .update(topics)
        .set({
          postCount: sql`${topics.postCount} + 1`,
          // Earns its way into the UI rather than appearing the moment the model invents it.
          status: sql`case when ${topics.status} = 'auto' and ${topics.postCount} + 1 >= ${TOPIC_PROMOTION_THRESHOLD} then 'approved' else ${topics.status} end`,
        })
        .where(eq(topics.slug, canonical));
    }
    attached.push(canonical);
  }

  return attached;
}

/**
 * Recomputes someone's inferred interests from their own posts' topics, with
 * older posts counting for less. Cheap enough to run per classified post at
 * this scale, and it keeps the profile in step with what they post about now.
 */
export async function refreshUserTopics(userId: string): Promise<void> {
  const rows = await db.execute(sql`
    select pt.topic as topic, pt.confidence as confidence, p.created_at as created_at
    from post_topics pt
    join posts p on p.id = pt.post_id
    join pets pe on pe.id = p.pet_id
    where pe.user_id = ${userId}
      and p.authored_by_agent = false
      and p.hidden_at is null
  `);

  const now = Date.now();
  const totals = new Map<string, { score: number; count: number }>();
  for (const row of rows as unknown as { topic: string; confidence: number; created_at: string }[]) {
    const entry = totals.get(row.topic) ?? { score: 0, count: 0 };
    entry.score += decayedScore(Number(row.confidence), now - new Date(row.created_at).getTime());
    entry.count += 1;
    totals.set(row.topic, entry);
  }

  if (totals.size === 0) return;

  for (const [topic, { score, count }] of totals) {
    await db
      .insert(userTopics)
      .values({ userId, topic, score, postCount: count })
      .onConflictDoUpdate({
        target: [userTopics.userId, userTopics.topic],
        set: { score, postCount: count, updatedAt: new Date() },
      });
  }
}

/**
 * Declared interests ∪ the interests behind someone's strongest inferred
 * topics. Declared alone is all a new account has; inferred alone would ignore
 * what they told us.
 */
export async function effectiveInterests(userId: string, declared: string[], limit = 5): Promise<string[]> {
  const rows = await db
    .select({ interest: topics.interest })
    .from(userTopics)
    .innerJoin(topics, eq(topics.slug, userTopics.topic))
    .where(eq(userTopics.userId, userId))
    .orderBy(desc(userTopics.score))
    .limit(limit);
  return [...new Set([...declared, ...rows.map((r) => r.interest)])];
}

/** Topic rows for a page of posts, for list endpoints that already paginate. */
export async function topicsByPostId(postIds: string[]): Promise<Map<string, string[]>> {
  const byId = new Map<string, string[]>(postIds.map((id) => [id, []]));
  if (postIds.length === 0) return byId;
  const rows = await db
    .select({ postId: postTopics.postId, topic: postTopics.topic })
    .from(postTopics)
    .where(inArray(postTopics.postId, postIds))
    .orderBy(desc(postTopics.confidence));
  for (const r of rows) byId.get(r.postId)?.push(r.topic);
  return byId;
}

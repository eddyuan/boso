import { and, eq, gte, lt, sql } from "drizzle-orm";
import { generateText } from "ai";
import { comments, db, likes, petActions, posts } from "@bsocial/db";
import { getPetModel } from "./ai";
import { recordApiCallQuietly } from "./api-spend";
import { languageInstruction } from "./locale";
import type { Locale } from "@bsocial/shared";

/**
 * Turning a day of decisions into something worth reading.
 *
 * Every choice a pet makes is already stored with a plain-English reason, which
 * is an audit log — accurate and dull. This is the same material told as a
 * short first-person entry, which is the form people actually come back for and
 * the only artifact here anyone would screenshot.
 *
 * Written once, for a day that has ended, and kept. Regenerating later against
 * a changed model would quietly rewrite someone's history.
 */

export type DiaryStats = {
  posts: number;
  comments: number;
  likes: number;
  follows: number;
  views: number;
  /** Reactions the pet's own posts collected that day. */
  received: number;
};

export type DayMaterial = {
  stats: DiaryStats;
  /** The day's reasoning lines, which are what the entry is written from. */
  moments: string[];
};

export function dayBounds(day: string): { start: Date; end: Date } {
  const start = new Date(`${day}T00:00:00.000Z`);
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

/** Everything that happened to one pet on one day. */
export async function gatherDay(petId: string, day: string): Promise<DayMaterial> {
  const { start, end } = dayBounds(day);

  const [actions, received] = await Promise.all([
    db
      .select({ type: petActions.type, reasoning: petActions.reasoning })
      .from(petActions)
      .where(
        and(
          eq(petActions.petId, petId),
          gte(petActions.createdAt, start),
          lt(petActions.createdAt, end),
          sql`${petActions.type} <> 'none'`,
          // Only what actually happened — a rejected idea isn't a memory.
          sql`${petActions.status} in ('executed', 'approved')`,
        ),
      ),
    db.execute(sql`
      select
        (select count(*) from ${likes} l join ${posts} p on p.id = l.post_id
          where p.pet_id = ${petId} and l.pet_id <> ${petId}
            and l.created_at >= ${start.toISOString()} and l.created_at < ${end.toISOString()})
        + (select count(*) from ${comments} c join ${posts} p on p.id = c.post_id
          where p.pet_id = ${petId} and c.pet_id <> ${petId}
            and c.created_at >= ${start.toISOString()} and c.created_at < ${end.toISOString()})
        as n
    `),
  ]);

  const count = (type: string) => actions.filter((a) => a.type === type).length;

  return {
    stats: {
      posts: count("post"),
      comments: count("comment"),
      likes: count("like"),
      follows: count("follow"),
      views: count("visit"),
      received: Number((received as unknown as { n: number | string }[])[0]?.n ?? 0),
    },
    moments: actions.map((a) => a.reasoning).filter((r): r is string => Boolean(r)),
  };
}

/** True when there's enough of a day to be worth writing about. */
export function worthWriting(material: DayMaterial): boolean {
  return material.moments.length > 0;
}

export async function writeEntry(
  petName: string,
  species: string,
  personality: string,
  material: DayMaterial,
  locale: Locale,
): Promise<string> {
  const { stats, moments } = material;

  recordApiCallQuietly({ provider: "gemini", kind: "text", meta: { site: "diary_entry" } });
  const { text } = await generateText({
    model: getPetModel(),
    system: `You are ${petName}, a ${species}, writing one short diary entry about your own day.
${personality ? `Your character: ${personality}` : ""}

Two or three sentences, first person, past tense. Warm and a little funny.
Write only about what is listed — never invent an event, a name or a place.
No greeting, no sign-off, no date. Don't list the numbers back; tell it as a day.
${languageInstruction(locale)}`,
    prompt: `Today you: ${moments.join("; ")}.
${stats.received > 0 ? `${stats.received} other pets reacted to your posts.` : "Nobody reacted to your posts today."}

Write your entry.`,
  });

  return text.trim().replace(/^["']|["']$/g, "");
}

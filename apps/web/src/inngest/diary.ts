import { and, eq, sql } from "drizzle-orm";
import { db, petDiary, pets, users } from "@bsocial/db";
import { inngest } from "./client";
import { dayBounds, gatherDay, worthWriting, writeEntry } from "../lib/diary";
import { petState } from "../lib/pet-mood";
import { sendPush } from "../lib/push";
import { isPetsPaused } from "../lib/settings";
import { tracked } from "@/lib/jobs";
import { translatorForUser } from "@/lib/locale";
import { resolveLocale } from "@bsocial/shared";

/**
 * The nightly diary, and the one morning message that carries it.
 *
 * Kept together because the digest exists to deliver the entry — sending a
 * separate "here's your morning update" that duplicates the diary would be two
 * notifications for one day.
 */

/** Yesterday in UTC, which is the day the entry is about. */
function yesterday(now: Date): string {
  const d = new Date(now.getTime() - 86_400_000);
  return d.toISOString().slice(0, 10);
}

export const writeDiaries = inngest.createFunction(
  { id: "write-diaries" },
  // Early UTC, so the entry exists before anyone's morning digest goes out.
  // Also runnable on demand from /admin/jobs, which is how a missed
  // nightly gets caught up without waiting for tomorrow.
  [{ cron: "20 6 * * *" }, { event: "admin/run.write-diaries" }],
  async ({step}) =>
    tracked("write-diaries", async () => {
    if (await step.run("check-paused", () => isPetsPaused())) return { written: 0, paused: true };

    const day = yesterday(new Date());
    const { start, end } = dayBounds(day);

    // Only pets that did something — an empty day gets no entry rather than a
    // manufactured one about nothing.
    const active = await step.run("find-active-pets", () =>
      db
        .select({
          petId: pets.id,
          name: pets.name,
          species: pets.species,
          personality: pets.personality,
          userId: pets.userId,
          locale: users.locale,
        })
        .from(pets)
        .innerJoin(users, eq(users.id, pets.userId))
        .where(
          and(
            sql`exists (
              select 1 from pet_actions a
              where a.pet_id = ${pets.id} and a.type <> 'none'
                and a.status in ('executed', 'approved')
                and a.created_at >= ${start.toISOString()} and a.created_at < ${end.toISOString()}
            )`,
            sql`not exists (
              select 1 from pet_diary d where d.pet_id = ${pets.id} and d.day = ${day}
            )`,
          ),
        ),
    );

    let written = 0;
    for (const pet of active) {
      const material = await gatherDay(pet.petId, day);
      if (!worthWriting(material)) continue;

      try {
        // The diary is the pet writing to its owner, so it is written in the
        // owner's language rather than translated after the fact.
        const entry = await writeEntry(pet.name, pet.species, pet.personality, material, resolveLocale(pet.locale));
        if (!entry) continue;
        const { mood } = await petState(pet.petId, pet.userId);

        await db
          .insert(petDiary)
          .values({ petId: pet.petId, day, entry, stats: material.stats, moodScore: mood.score })
          // A retry shouldn't produce a second entry for the same day.
          .onConflictDoNothing();
        written += 1;
      } catch (error) {
        console.error(`[diary] ${pet.name} (${day}):`, error);
      }
    }

    return { day, considered: active.length, written };
  }),
);

export const morningDigest = inngest.createFunction(
  { id: "morning-digest" },
  // Hourly; each user is only sent to when it's actually morning where they are.
  // Also runnable on demand from /admin/jobs, which is how a missed
  // nightly gets caught up without waiting for tomorrow.
  [{ cron: "0 * * * *" }, { event: "admin/run.morning-digest" }],
  async ({step}) =>
    tracked("morning-digest", async () => {
    if (await step.run("check-paused", () => isPetsPaused())) return { sent: 0, paused: true };

    const day = yesterday(new Date());

    const entries = await step.run("find-entries", () =>
      db
        .select({
          userId: users.id,
          petName: pets.name,
          entry: petDiary.entry,
          longitude: users.lastLongitude,
        })
        .from(petDiary)
        .innerJoin(pets, eq(pets.id, petDiary.petId))
        .innerJoin(users, eq(users.id, pets.userId))
        .where(and(eq(petDiary.day, day), eq(users.isMock, false))),
    );

    const utcHour = new Date().getUTCHours();
    let sent = 0;

    for (const row of entries) {
      // Roughly 8am where they are. Without a stored timezone this is derived
      // from longitude, same approximation quiet hours uses; a missing position
      // means we can't tell it's their morning, so we don't guess.
      if (row.longitude === null) continue;
      const localHour = (((utcHour + Math.round(row.longitude / 15)) % 24) + 24) % 24;
      if (localHour !== 8) continue;

      const result = await sendPush(row.userId, {
        type: "quiet_return",
        title: (await translatorForUser(row.userId)).t("push.digest.title", { name: row.petName }),
        body: row.entry.length > 140 ? `${row.entry.slice(0, 139)}…` : row.entry,
        data: { screen: "activity", day },
      });
      if (result.sent) sent += 1;
    }

    return { day, candidates: entries.length, sent };
  }),
);

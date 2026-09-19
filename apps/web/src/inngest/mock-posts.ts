import { desc, eq } from "drizzle-orm";
import { db, mockProfiles, pets, posts, users } from "@bsocial/db";
import { inngest } from "./client";
import { generateMockPost, petForMockUser } from "../lib/mock-poster";
import { attachPostMedia } from "../lib/post-media";
import { resolvePetPostLocation } from "../lib/pet-location";
import { alreadyPosted, dueSlot, parseSchedule } from "../lib/posting-schedule";
import { isPetsPaused } from "../lib/settings";

/**
 * Seeded personas posting on their own schedule.
 *
 * This is the only lever that makes a neighbourhood look inhabited before real
 * users arrive — the personas have had voices, schedules and coordinates for a
 * while and have never posted unless an admin pressed a button.
 *
 * Separate from the pet loop (inngest/functions.ts): that's every pet doing
 * small social actions, this is a handful of accounts behaving like people.
 */

/** Roughly how often a post comes with photos. Not every thought is illustrated. */
const IMAGE_CHANCE = 0.55;
const MAX_IMAGES = 3;

export const scheduleMockPosts = inngest.createFunction(
  { id: "schedule-mock-posts" },
  { cron: "0 * * * *" },
  async ({ step }) => {
    // The panic button stops everything autonomous, bots included — a pause
    // that leaves eight accounts posting isn't much of a pause.
    if (await step.run("check-paused", () => isPetsPaused())) return { fanned: 0, paused: true };

    const candidates = await step.run("load-personas", () =>
      db
        .select({
          userId: mockProfiles.userId,
          schedule: mockProfiles.postingSchedule,
          petId: pets.id,
        })
        .from(mockProfiles)
        .innerJoin(users, eq(users.id, mockProfiles.userId))
        .innerJoin(pets, eq(pets.userId, mockProfiles.userId)),
    );

    const now = new Date();
    const due: { userId: string; slot: number }[] = [];

    for (const candidate of candidates) {
      const schedule = parseSchedule(candidate.schedule);
      if (!schedule) continue;
      const slot = dueSlot(schedule, now);
      if (slot === null) continue;

      // Don't post twice for the same slot if a run is retried or overlaps.
      const [last] = await db
        .select({ createdAt: posts.createdAt })
        .from(posts)
        .where(eq(posts.petId, candidate.petId))
        .orderBy(desc(posts.createdAt))
        .limit(1);
      if (alreadyPosted(last?.createdAt ?? null, slot, schedule, now)) continue;

      due.push({ userId: candidate.userId, slot });
    }

    if (due.length === 0) return { fanned: 0 };

    await step.sendEvent(
      "fan-out-mock-posts",
      due.map((d) => ({ name: "mock/post" as const, data: d })),
    );
    return { fanned: due.length };
  },
);

export const runMockPost = inngest.createFunction(
  {
    id: "run-mock-post",
    // One at a time per persona, so a retry can't double-post.
    concurrency: { key: "event.data.userId", limit: 1 },
    retries: 2,
  },
  { event: "mock/post" },
  async ({ event, step }) => {
    const { userId, slot } = event.data;

    const context = await step.run("load-persona", async () => {
      const [profile] = await db.select().from(mockProfiles).where(eq(mockProfiles.userId, userId));
      if (!profile) return null;
      const pet = await petForMockUser(userId);
      return pet ? { profile, pet } : null;
    });
    if (!context) return { skipped: "no persona or pet" };

    const imageCount = Math.random() < IMAGE_CHANCE ? 1 + Math.floor(Math.random() * MAX_IMAGES) : 0;

    const draft = await step.run("write-post", () =>
      generateMockPost(context.profile, context.pet, { imageCount }),
    );

    const at = await step.run("place-post", () => resolvePetPostLocation(userId));

    const postId = await step.run("publish", async () => {
      const [post] = await db
        .insert(posts)
        .values({
          petId: context.pet.id,
          content: draft.content,
          authoredByAgent: true,
          latitude: at?.latitude ?? null,
          longitude: at?.longitude ?? null,
          placeId: at?.placeId ?? null,
        })
        .returning({ id: posts.id });

      await attachPostMedia(post!.id, draft.images);
      // Personas post unreviewed, so this matters more here than anywhere.
      await db.update(users).set({ lastActiveAt: new Date() }).where(eq(users.id, userId));
      return post!.id;
    });

    await step.sendEvent("classify", { name: "post/created", data: { postId } });

    return { postId, slot, images: draft.images.length, placed: at !== null };
  },
);

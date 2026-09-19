import { and, desc, eq, gt, isNotNull, isNull } from "drizzle-orm";
import { db, pets, posts, users } from "@bsocial/db";
import { PET_OWNER_INACTIVE_DAYS } from "@bsocial/shared";
import { inngest } from "./client";
import { describePersonality, generateComment, generatePost } from "../lib/agent";
import { recordDecision } from "../lib/actions";
import { getActionBudget } from "../lib/action-budget";
import { loadPlannerCandidates, planAction } from "../lib/pet-planner";
import { isPetsPaused } from "../lib/settings";
import { tracked } from "@/lib/jobs";

// Pets act only for owners who are onboarded, not age-restricted, and were
// active in the app within PET_OWNER_INACTIVE_DAYS.
function activeOwnerFilter() {
  const activeSince = new Date(Date.now() - PET_OWNER_INACTIVE_DAYS * 24 * 60 * 60 * 1000);
  return and(
    isNotNull(users.onboardingCompletedAt),
    isNull(users.ageGateFailedAt),
    gt(users.lastActiveAt, activeSince),
  );
}

/**
 * Hourly fan-out: fires one "pet/tick" event per pet whose owner is active
 * (see activeOwnerFilter). Per-pet limits are enforced inside runPetTick, so
 * this stays a cheap query.
 */
export const schedulePetTicks = inngest.createFunction(
  { id: "schedule-pet-ticks" },
  // Also runnable on demand from /admin/jobs, which is how a missed
  // nightly gets caught up without waiting for tomorrow.
  [{ cron: "0 * * * *" }, { event: "admin/run.schedule-pet-ticks" }],
  async ({step}) =>
    tracked("schedule-pet-ticks", async () => {
    // Admin kill switch (Settings on the dashboard). Checked here so pausing
    // stops the whole fan-out rather than 8000 ticks each deciding to no-op.
    if (await step.run("check-paused", () => isPetsPaused())) return { fanned: 0, paused: true };

    const eligiblePets = await step.run("load-pets", () =>
      db
        .select({ id: pets.id })
        .from(pets)
        .innerJoin(users, eq(users.id, pets.userId))
        .where(activeOwnerFilter()),
    );

    if (eligiblePets.length === 0) return { fanned: 0 };

    await step.sendEvent(
      "fan-out-ticks",
      eligiblePets.map((pet) => ({ name: "pet/tick" as const, data: { petId: pet.id } })),
    );

    return { fanned: eligiblePets.length };
  }),
);

/**
 * One tick for a single pet:
 *   1. check its rolling 24h allowance
 *   2. pick an action with rules (like / visit / follow / comment / post / nothing)
 *   3. only for content (post, comment), ask the AI model to write the text
 *   4. record it (auto-executed or queued for approval, see lib/actions.ts)
 */
export const runPetTick = inngest.createFunction(
  {
    id: "run-pet-tick",
    // One tick per pet at a time, so two runs can't both pass the budget check.
    concurrency: { key: "event.data.petId", limit: 1 },
  },
  { event: "pet/tick" },
  async ({event, step}) =>
    tracked("run-pet-tick", async () => {
    const petId = event.data.petId;

    // Re-checked per tick, not just at fan-out: ticks queued before the pause
    // would otherwise still run after an admin hit the switch.
    if (await step.run("check-paused", () => isPetsPaused())) return { skipped: "pets paused" };

    const pet = await step.run("load-pet", async () => {
      const [row] = await db
        .select({ pet: pets, ownerInterests: users.interests })
        .from(pets)
        .innerJoin(users, eq(users.id, pets.userId))
        // Re-checked here: the owner may have gone inactive since the fan-out.
        .where(and(eq(pets.id, petId), activeOwnerFilter()));
      return row ?? null;
    });
    if (!pet) return { skipped: "pet not found or owner inactive" };

    const budget = await step.run("check-budget", () =>
      getActionBudget(petId, pet.pet.maxActionsPerDay),
    );
    if (budget.remaining === 0) return { skipped: "daily action limit reached", budget };

    // Planned inside a step so the random choice is memoized across retries.
    const plan = await step.run("plan", async () => {
      const candidates = await loadPlannerCandidates(petId, pet.pet.userId, pet.ownerInterests);
      return planAction({ ...candidates, canPost: budget.canPost, canComment: budget.canComment });
    });

    if (plan.action === "post") {
      const content = await step.run("write-post", async () => {
        const recent = await db
          .select({ content: posts.content })
          .from(posts)
          .where(eq(posts.petId, petId))
          .orderBy(desc(posts.createdAt))
          .limit(5);
        return generatePost({
          petName: pet.pet.name,
          personality: describePersonality(pet.pet, pet.ownerInterests),
          recentOwnPosts: recent.map((p) => p.content),
        });
      });

      await step.run("record-decision", () =>
        recordDecision(
          petId,
          content
            ? { action: "post", content, reasoning: plan.reasoning }
            : { action: "none", reasoning: "The model didn't write a usable post." },
        ),
      );
      return { petId, action: content ? "post" : "none", budget };
    }

    if (plan.action === "comment") {
      const content = await step.run("write-comment", () =>
        generateComment({
          petName: pet.pet.name,
          personality: describePersonality(pet.pet, pet.ownerInterests),
          postAuthor: plan.postAuthor,
          postContent: plan.postContent,
        }),
      );

      await step.run("record-decision", () =>
        recordDecision(
          petId,
          content
            ? { action: "comment", postId: plan.postId, content, reasoning: plan.reasoning }
            : { action: "none", reasoning: "The model didn't write a usable reply." },
        ),
      );
      return { petId, action: content ? "comment" : "none", budget };
    }

    await step.run("record-decision", () => recordDecision(petId, plan));
    return { petId, action: plan.action, budget };
  }),
);

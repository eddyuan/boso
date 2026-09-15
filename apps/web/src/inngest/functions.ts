import { and, desc, eq, inArray, ne, notInArray } from "drizzle-orm";
import { db, follows, pets, posts } from "@bsocial/db";
import { inngest } from "./client";
import { decideNextAction, type PetContext } from "../lib/agent";
import { recordDecision } from "../lib/actions";

/**
 * Hourly fan-out: finds pets due for a decision cycle and fires one
 * "pet/tick" event per pet. Kept dumb on purpose — per-pet rate limiting
 * (maxActionsPerDay) is enforced inside runPetTick, not here, so this stays
 * a cheap query with no business logic to drift out of sync.
 */
export const schedulePetTicks = inngest.createFunction(
  { id: "schedule-pet-ticks" },
  { cron: "0 * * * *" },
  async ({ step }) => {
    const eligiblePets = await step.run("load-pets", () => db.select({ id: pets.id }).from(pets));

    await step.sendEvent(
      "fan-out-ticks",
      eligiblePets.map((pet) => ({ name: "pet/tick" as const, data: { petId: pet.id } })),
    );

    return { fanned: eligiblePets.length };
  },
);

/**
 * One decision cycle for a single pet: gather context, ask Claude for exactly
 * one action, then record it (auto-executed or queued for approval depending
 * on the pet's autoApprove setting — see lib/actions.ts).
 */
export const runPetTick = inngest.createFunction(
  { id: "run-pet-tick" },
  { event: "pet/tick" },
  async ({ event, step }) => {
    const petId = event.data.petId;

    const context = await step.run("gather-context", async (): Promise<PetContext | null> => {
      const [pet] = await db.select().from(pets).where(eq(pets.id, petId));
      if (!pet) return null;

      const recentOwnPosts = await db
        .select({ content: posts.content })
        .from(posts)
        .where(eq(posts.petId, petId))
        .orderBy(desc(posts.createdAt))
        .limit(5);

      const following = await db
        .select({ id: follows.followingPetId })
        .from(follows)
        .where(eq(follows.followerPetId, petId));
      const followingIds = following.map((f) => f.id);

      const feedPets = followingIds.length > 0 ? followingIds : undefined;
      const feedPosts = await db
        .select({ id: posts.id, content: posts.content, petName: pets.name })
        .from(posts)
        .innerJoin(pets, eq(pets.id, posts.petId))
        .where(
          and(ne(posts.petId, petId), feedPets ? inArray(posts.petId, feedPets) : undefined),
        )
        .orderBy(desc(posts.createdAt))
        .limit(10);

      const excludeIds = [petId, ...followingIds];
      const followable = await db
        .select({ id: pets.id, name: pets.name })
        .from(pets)
        .where(notInArray(pets.id, excludeIds))
        .limit(5);

      return {
        petName: pet.name,
        personality: pet.personality,
        recentOwnPosts: recentOwnPosts.map((p) => p.content),
        recentFeedPosts: feedPosts,
        followablePets: followable,
      };
    });

    if (!context) return { skipped: "pet not found" };

    const decision = await step.run("decide", () => decideNextAction(context));

    await step.run("record-decision", () => recordDecision(petId, decision));

    return { petId, decision: decision.action };
  },
);

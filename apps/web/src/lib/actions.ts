import { db, pets, posts, comments, likes, follows, petActions, users } from "@bsocial/db";
import { eq } from "drizzle-orm";
// A concrete action ready to record: planner decisions (lib/pet-planner.ts),
// with post text filled in by lib/agent.ts.
export type PetAction =
  | { action: "post"; content: string; reasoning: string }
  | { action: "like"; postId: string; reasoning: string }
  | { action: "comment"; postId: string; content: string; reasoning: string }
  | { action: "follow"; petId: string; reasoning: string }
  | { action: "visit"; petId: string; reasoning: string }
  | { action: "none"; reasoning: string };

/**
 * Persists a pet action as a pet_actions row, and — if the pet is set to
 * auto-approve — immediately carries it out (creates the post/like/follow).
 * When auto-approve is off, the row stays "pending" until a user approves it
 * from the "what my pet did" review screen.
 */
export async function recordDecision(petId: string, decision: PetAction) {
  if (decision.action === "none") {
    return db.insert(petActions).values({
      petId,
      type: "none",
      status: "executed",
      payload: {},
      reasoning: decision.reasoning,
      executedAt: new Date(),
    });
  }

  const [pet] = await db.select().from(pets).where(eq(pets.id, petId));
  if (!pet) throw new Error(`Pet ${petId} not found`);

  const { action, reasoning, ...rest } = decision;
  const [row] = await db
    .insert(petActions)
    .values({
      petId,
      type: action,
      status: pet.autoApprove ? "executed" : "pending",
      payload: rest,
      reasoning,
      executedAt: pet.autoApprove ? new Date() : null,
    })
    .returning();

  if (pet.autoApprove) {
    await executeAction(petId, decision);
    await db.update(users).set({ lastActiveAt: new Date() }).where(eq(users.id, pet.userId));
  }

  return row;
}

/** Carries out an approved decision. Called either immediately (auto-approve) or from the approval endpoint. */
export async function executeAction(petId: string, decision: PetAction) {
  switch (decision.action) {
    case "post":
      return db.insert(posts).values({
        petId,
        content: decision.content,
        authoredByAgent: true,
      });
    case "like":
      return db.insert(likes).values({ petId, postId: decision.postId }).onConflictDoNothing();
    case "comment":
      return db.insert(comments).values({
        petId,
        postId: decision.postId,
        content: decision.content,
        authoredByAgent: true,
      });
    case "follow":
      return db
        .insert(follows)
        .values({ followerPetId: petId, followingPetId: decision.petId })
        .onConflictDoNothing();
    case "visit":
      // Logged in pet_actions only for now (no "visited you" feed yet).
      return;
    case "none":
      return;
  }
}

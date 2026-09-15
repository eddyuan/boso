import { db, pets, posts, comments, likes, follows, petActions } from "@bsocial/db";
import { eq } from "drizzle-orm";
import type { AgentDecision } from "./agent";

/**
 * Persists an agent decision as a pet_actions row, and — if the pet is set to
 * auto-approve — immediately carries it out (creates the post/like/comment/follow).
 * When auto-approve is off, the row stays "pending" until a user approves it
 * from the "what my pet did" review screen.
 */
export async function recordDecision(petId: string, decision: AgentDecision) {
  if (decision.action === "none") {
    return db.insert(petActions).values({
      petId,
      type: "post", // placeholder type; no-ops aren't shown in the review UI
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
  }

  return row;
}

/** Carries out an approved decision. Called either immediately (auto-approve) or from the approval endpoint. */
export async function executeAction(petId: string, decision: AgentDecision) {
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
    case "none":
      return;
  }
}

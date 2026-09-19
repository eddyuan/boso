import { db, pets, petTreasures, posts, comments, likes, follows, petActions, postViews, users } from "@bsocial/db";
import { eq } from "drizzle-orm";
import { inngest } from "@/inngest/client";
import { resolvePetPostLocation } from "@/lib/pet-location";
import { sendPush } from "@/lib/push";
import { recordInteraction } from "@/lib/relationships";
import { rollTreasure } from "@bsocial/shared";
import { getConfig } from "./config";
import { translatorForUser } from "./locale";
// A concrete action ready to record: planner decisions (lib/pet-planner.ts),
// with post text filled in by lib/agent.ts.
export type PetAction =
  | { action: "post"; content: string; reasoning: string }
  | { action: "like"; postId: string; reasoning: string }
  | { action: "comment"; postId: string; content: string; reasoning: string }
  | { action: "follow"; petId: string; reasoning: string }
  | { action: "visit"; postId: string; reasoning: string }
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
  } else {
    // Otherwise it sits in Activity until answered, which nobody discovers by
    // chance — this is the whole reason "ask me first" felt like a dead end.
    const t = await translatorForUser(pet.userId);
    await sendPush(pet.userId, {
      type: "pet_ask",
      title: t.t("push.ask.title", { name: pet.name }),
      // The reasoning is the pet's own words, already written in their language
      // by the planner, so it's used as-is; only the fallback is translated.
      body: reasoning || t.t("push.ask.body", { name: pet.name }),
      data: { screen: "pet", actionId: row!.id },
    }).catch((error) => console.error("[actions] ask notification failed:", error));
  }

  return row;
}

/** Carries out an approved decision. Called either immediately (auto-approve) or from the approval endpoint. */
export async function executeAction(petId: string, decision: PetAction) {
  const { values } = await getConfig();
  const findChance = values["treasures.findChance"];
  switch (decision.action) {
    case "post": {
      // Without coordinates a pet post never reaches the map or Nearby, which
      // is most of the app's content missing from most of its surfaces.
      const [owner] = await db.select({ userId: pets.userId }).from(pets).where(eq(pets.id, petId));
      const at = owner ? await resolvePetPostLocation(owner.userId) : null;

      const [post] = await db
        .insert(posts)
        .values({
          petId,
          content: decision.content,
          authoredByAgent: true,
          latitude: at?.latitude ?? null,
          longitude: at?.longitude ?? null,
          placeId: at?.placeId ?? null,
        })
        .returning({ id: posts.id });

      // A trip out is also a chance to bring something home. Most find nothing,
      // which is what makes finding something feel like anything.
      if (at) {
        const found = rollTreasure(at.placeCategory ?? null, Math.random, findChance);
        if (found) {
          await db
            .insert(petTreasures)
            .values({ petId, kind: found.id, placeId: at.placeId })
            .catch((error) => console.error("[actions] treasure insert failed:", error));
        }
      }
      // Pet posts are classified like anyone else's — more so, since nothing
      // human reads them before they land on the map.
      await inngest.send({ name: "post/created", data: { postId: post!.id } }).catch((error) => {
        console.error("[actions] failed to queue classification:", error);
      });
      return post;
    }
    case "like": {
      const inserted = await db
        .insert(likes)
        .values({ petId, postId: decision.postId })
        .onConflictDoNothing()
        .returning({ id: likes.id });
      if (inserted.length > 0) await creditPostAuthor(petId, decision.postId, "like");
      return inserted;
    }
    case "comment": {
      const written = await db
        .insert(comments)
        .values({ petId, postId: decision.postId, content: decision.content, authoredByAgent: true })
        .returning({ id: comments.id });
      await creditPostAuthor(petId, decision.postId, "comment");
      return written;
    }
    case "follow": {
      const inserted = await db
        .insert(follows)
        .values({ followerPetId: petId, followingPetId: decision.petId })
        .onConflictDoNothing()
        .returning({ id: follows.id });

      // Only on a genuinely new follow, so a repeat can't buzz someone twice.
      if (inserted.length > 0) {
        const [follower] = await db.select({ name: pets.name }).from(pets).where(eq(pets.id, petId));
        const [followed] = await db
          .select({ userId: pets.userId, name: pets.name })
          .from(pets)
          .where(eq(pets.id, decision.petId));
        if (follower && followed) {
          await recordInteraction(petId, decision.petId, "follow");
          // Written in the recipient's language, not the acting pet owner's.
          const t = await translatorForUser(followed.userId);
          await sendPush(followed.userId, {
            type: "pet_friend",
            title: t.t("push.followed.title", { name: followed.name }),
            body: t.t("push.followed.body", { name: followed.name, other: follower.name }),
            data: { screen: "pet" },
          }).catch((error) => console.error("[actions] friend notification failed:", error));
        }
      }
      return inserted;
    }
    case "visit": {
      const viewed = await db
        .insert(postViews)
        .values({ petId, postId: decision.postId })
        .onConflictDoNothing()
        .returning({ id: postViews.id });
      if (viewed.length > 0) await creditPostAuthor(petId, decision.postId, "visit");
      return viewed;
    }
    case "none":
      return;
  }
}

/**
 * Credits the pair behind an interaction with a post. Relationships accumulate
 * as a side effect of the loop behaving normally, rather than needing a system
 * of their own.
 */
async function creditPostAuthor(
  actorPetId: string,
  postId: string,
  event: "like" | "comment" | "visit",
): Promise<void> {
  const [post] = await db.select({ petId: posts.petId }).from(posts).where(eq(posts.id, postId));
  if (!post) return;
  await recordInteraction(actorPetId, post.petId, event).catch((error) =>
    console.error("[actions] affinity update failed:", error),
  );
}

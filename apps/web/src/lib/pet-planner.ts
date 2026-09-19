import { and, desc, eq, gt, inArray, isNotNull, isNull, ne, notInArray, sql } from "drizzle-orm";
import { comments, db, follows, likes, pets, postViews, posts, users } from "@bsocial/db";
import { INTERESTS } from "@bsocial/shared";
import { petCandidatePosts } from "./visibility";

// Rule-based pet behaviour. Each hourly tick picks at most one action with
// plain logic; AI is used only to write content (post text, comment replies)
// in lib/agent.ts.

// Chance a tick does anything at all. With hourly ticks this spreads ~8
// actions across a day, so the 5/day cap is reached gradually, not in a burst.
export const ACT_CHANCE_PER_TICK = 0.35;
// Chance an acting tick posts (when posting is allowed): about one post a day.
export const POST_CHANCE_PER_ACTING_TICK = 0.15;
// Relative weights among the social actions that have candidates.
const ACTION_WEIGHTS = { like: 5, visit: 3, comment: 2, follow: 2 } as const;
const LIKE_LOOKBACK_HOURS = 48;
const CANDIDATE_LIMIT = 20;

export type PetDecision =
  | { action: "post"; reasoning: string }
  | { action: "like"; postId: string; reasoning: string }
  // Text is written afterwards by the AI (lib/agent.ts generateComment).
  | { action: "comment"; postId: string; postAuthor: string; postContent: string; reasoning: string }
  | { action: "follow"; petId: string; reasoning: string }
  // Viewing a post — recorded in post_views so its owner can see who viewed it.
  | { action: "visit"; postId: string; reasoning: string }
  | { action: "none"; reasoning: string };

type Candidate = { id: string; name: string; sharedInterests: string[] };

type PostCandidate = Candidate & { postId: string; content: string };

export type PlannerContext = {
  canPost: boolean;
  canComment: boolean;
  likeCandidates: PostCandidate[];
  commentCandidates: PostCandidate[];
  followCandidates: Candidate[];
  visitCandidates: PostCandidate[];
};

const interestLabel = (value: string) => INTERESTS.find((i) => i.value === value)?.label ?? value;

function because(c: Candidate) {
  return c.sharedInterests.length
    ? ` (you both like ${c.sharedInterests.slice(0, 2).map(interestLabel).join(" & ")})`
    : "";
}

// Weighted random pick favouring candidates with more shared interests.
function pickCandidate<T extends Candidate>(list: T[], rng: () => number): T {
  const weights = list.map((c) => 1 + c.sharedInterests.length * 2);
  let r = rng() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < list.length; i++) {
    r -= weights[i]!;
    if (r < 0) return list[i]!;
  }
  return list[list.length - 1]!;
}

/** Pure decision logic (no I/O), so it's easy to test with a seeded rng. */
export function planAction(ctx: PlannerContext, rng: () => number = Math.random): PetDecision {
  if (rng() >= ACT_CHANCE_PER_TICK) return { action: "none", reasoning: "Resting this hour." };

  if (ctx.canPost && rng() < POST_CHANCE_PER_ACTING_TICK) {
    return { action: "post", reasoning: "Time to share something." };
  }

  const options = (
    [
      ["like", ctx.likeCandidates.length],
      ["visit", ctx.visitCandidates.length],
      ["comment", ctx.canComment ? ctx.commentCandidates.length : 0],
      ["follow", ctx.followCandidates.length],
    ] as const
  ).filter(([, n]) => n > 0);

  if (options.length === 0) {
    // Nothing social to do; posting is the only way to be active.
    return ctx.canPost
      ? { action: "post", reasoning: "Nothing new around, so sharing something." }
      : { action: "none", reasoning: "Nothing to do right now." };
  }

  let r = rng() * options.reduce((sum, [a]) => sum + ACTION_WEIGHTS[a], 0);
  const choice = options.find(([a]) => (r -= ACTION_WEIGHTS[a]) < 0)?.[0] ?? options[0]![0];

  switch (choice) {
    case "like": {
      const c = pickCandidate(ctx.likeCandidates, rng);
      return { action: "like", postId: c.postId, reasoning: `Liked a post from ${c.name}${because(c)}.` };
    }
    case "comment": {
      const c = pickCandidate(ctx.commentCandidates, rng);
      return {
        action: "comment",
        postId: c.postId,
        postAuthor: c.name,
        postContent: c.content,
        reasoning: `Replied to ${c.name}${because(c)}.`,
      };
    }
    case "visit": {
      const c = pickCandidate(ctx.visitCandidates, rng);
      return { action: "visit", postId: c.postId, reasoning: `Viewed a post from ${c.name}${because(c)}.` };
    }
    case "follow": {
      const c = pickCandidate(ctx.followCandidates, rng);
      return { action: "follow", petId: c.id, reasoning: `Followed ${c.name}${because(c)}.` };
    }
  }
}

/** Loads the candidates the planner chooses from. */
export async function loadPlannerCandidates(
  petId: string,
  ownerId: string,
  ownerInterests: string[],
): Promise<Omit<PlannerContext, "canPost" | "canComment">> {
  const shared = (interests: string[]) => interests.filter((i) => ownerInterests.includes(i));
  const now = Date.now();

  const followingRows = await db
    .select({ id: follows.followingPetId })
    .from(follows)
    .where(eq(follows.followerPetId, petId));
  const followingIds = followingRows.map((f) => f.id);

  // Only interact with pets whose owners are real, onboarded accounts.
  const eligibleOwner = and(isNotNull(users.onboardingCompletedAt), isNull(users.ageGateFailedAt));

  // Like / comment / visit: recent posts from followed pets this pet hasn't
  // liked, commented on, or viewed yet.
  const recentFollowedPosts = followingIds.length
    ? await db
        .select({
          postId: posts.id,
          content: posts.content,
          id: pets.id,
          name: pets.name,
          interests: users.interests,
          liked: sql<boolean>`${likes.id} is not null`,
          commented: sql<boolean>`exists (select 1 from ${comments} where ${comments.postId} = ${posts.id} and ${comments.petId} = ${petId})`,
          viewed: sql<boolean>`${postViews.id} is not null`,
        })
        .from(posts)
        .innerJoin(pets, eq(pets.id, posts.petId))
        .innerJoin(users, eq(users.id, pets.userId))
        .leftJoin(likes, and(eq(likes.postId, posts.id), eq(likes.petId, petId)))
        .leftJoin(postViews, and(eq(postViews.postId, posts.id), eq(postViews.petId, petId)))
        .where(
          and(
            inArray(posts.petId, followingIds),
            gt(posts.createdAt, new Date(now - LIKE_LOOKBACK_HOURS * 3600 * 1000)),
            eligibleOwner,
            // Stricter than a human reader gets: an agent never amplifies
            // anything a human hasn't cleared.
            petCandidatePosts(),
          ),
        )
        .orderBy(desc(posts.createdAt))
        .limit(CANDIDATE_LIMIT)
    : [];

  // Follow: pets not yet followed, preferring owners with overlapping interests.
  const followRows = await db
    .select({ id: pets.id, name: pets.name, interests: users.interests })
    .from(pets)
    .innerJoin(users, eq(users.id, pets.userId))
    .where(
      and(
        ne(pets.id, petId),
        ne(users.id, ownerId),
        followingIds.length ? notInArray(pets.id, followingIds) : undefined,
        eligibleOwner,
        ownerInterests.length
          ? sql`${users.interests} && ${sql.param(ownerInterests)}::text[]`
          : undefined,
      ),
    )
    .orderBy(sql`random()`)
    .limit(CANDIDATE_LIMIT);

  const toCandidate = (r: { id: string; name: string; interests: string[] }): Candidate => ({
    id: r.id,
    name: r.name,
    sharedInterests: shared(r.interests),
  });

  return {
    likeCandidates: recentFollowedPosts
      .filter((r) => !r.liked)
      .map((r) => ({ ...toCandidate(r), postId: r.postId, content: r.content })),
    commentCandidates: recentFollowedPosts
      .filter((r) => !r.commented)
      .map((r) => ({ ...toCandidate(r), postId: r.postId, content: r.content })),
    followCandidates: followRows.map(toCandidate),
    visitCandidates: recentFollowedPosts
      .filter((r) => !r.viewed)
      .map((r) => ({ ...toCandidate(r), postId: r.postId, content: r.content })),
  };
}

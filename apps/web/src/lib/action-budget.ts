import { and, count, eq, gt, inArray, ne, sql } from "drizzle-orm";
import { db, petActions } from "@bsocial/db";
import { PET_ACTION_WINDOW_HOURS, PET_MAX_COMMENTS_PER_DAY, PET_MAX_POSTS_PER_DAY } from "@bsocial/shared";

export type ActionBudget = {
  actionsUsed: number;
  postsUsed: number;
  commentsUsed: number;
  remaining: number;
  canPost: boolean;
  canComment: boolean;
};

// How much of a pet's rolling-window allowance is used. Pending actions count
// (they're already queued for the owner), rejected/failed ones don't, and
// "none" decisions never do.
export async function getActionBudget(petId: string, maxActionsPerDay: number): Promise<ActionBudget> {
  const since = new Date(Date.now() - PET_ACTION_WINDOW_HOURS * 60 * 60 * 1000);
  const [row] = await db
    .select({
      actions: count(),
      posts: sql<number>`count(*) filter (where ${petActions.type} = 'post')`.mapWith(Number),
      comments: sql<number>`count(*) filter (where ${petActions.type} = 'comment')`.mapWith(Number),
    })
    .from(petActions)
    .where(
      and(
        eq(petActions.petId, petId),
        gt(petActions.createdAt, since),
        ne(petActions.type, "none"),
        inArray(petActions.status, ["pending", "approved", "executed"]),
      ),
    );

  const actionsUsed = row?.actions ?? 0;
  const postsUsed = row?.posts ?? 0;
  const commentsUsed = row?.comments ?? 0;
  const remaining = Math.max(0, maxActionsPerDay - actionsUsed);
  return {
    actionsUsed,
    postsUsed,
    commentsUsed,
    remaining,
    canPost: remaining > 0 && postsUsed < PET_MAX_POSTS_PER_DAY,
    canComment: remaining > 0 && commentsUsed < PET_MAX_COMMENTS_PER_DAY,
  };
}

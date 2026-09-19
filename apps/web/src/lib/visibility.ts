import { sql, type SQL } from "drizzle-orm";
import { posts } from "@bsocial/db";

/**
 * Who may see which posts. Centralised because the rule has to hold identically
 * across the feed, the map and search — a surface that forgets it silently
 * leaks flagged content.
 *
 * Two independent gates: `hiddenAt` is an admin's manual override, and
 * `moderationStatus` is the classifier's verdict. A post has to pass both.
 */

/** Amplified surfaces: Nearby, Discover, the map and search. */
export function amplifiedPosts(): SQL {
  return sql`${posts.hiddenAt} is null and ${posts.moderationStatus} in ('approved', 'sensitive')`;
}

/**
 * Following: `restricted` posts are legal-but-unamplified, so they're reachable
 * here — the reader already chose to follow this pet — and nowhere else.
 */
export function followedPosts(): SQL {
  return sql`${posts.hiddenAt} is null and ${posts.moderationStatus} in ('approved', 'sensitive', 'restricted')`;
}

/** An author always sees their own posts, so moderation is never silent to them. */
export function ownOrVisible(ownPetId: string, base: SQL): SQL {
  return sql`(${posts.petId} = ${ownPetId} and ${posts.moderationStatus} <> 'blocked' or (${base}))`;
}

/**
 * What a pet may like, comment on or view. Deliberately stricter than what a
 * person can read: an agent should never amplify something a human hasn't
 * cleared, so anything short of `approved` is off limits.
 */
export function petCandidatePosts(): SQL {
  return sql`${posts.hiddenAt} is null and ${posts.moderationStatus} = 'approved'`;
}

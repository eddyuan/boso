import { asc, eq, inArray } from "drizzle-orm";
import { db, postMedia } from "@bsocial/db";

/** A post can carry a small gallery rather than exactly one photo. */
export const MAX_POST_MEDIA = 20;

export type PostMediaItem = { url: string; thumbUrl: string | null; kind: "image" | "video" };
export type NewPostMedia = { url: string; thumbUrl?: string | null; kind?: "image" | "video" };

/** Insert a post's media in order. No-op for an empty list. */
export async function attachPostMedia(postId: string, media: NewPostMedia[]): Promise<void> {
  if (media.length === 0) return;
  await db.insert(postMedia).values(
    media.map((m, i) => ({
      postId,
      url: m.url,
      thumbUrl: m.thumbUrl ?? null,
      kind: m.kind ?? "image",
      position: i,
    })),
  );
}

/**
 * Fetch media for a page of posts in one query and group it by post id — for
 * list endpoints, which already paginate the posts themselves. Every id gets
 * an entry (possibly empty), so callers can index without an `?? []`.
 */
export async function mediaByPostId(postIds: string[]): Promise<Map<string, PostMediaItem[]>> {
  const byId = new Map<string, PostMediaItem[]>(postIds.map((id) => [id, []]));
  if (postIds.length === 0) return byId;

  const rows = await db
    .select({ postId: postMedia.postId, url: postMedia.url, thumbUrl: postMedia.thumbUrl, kind: postMedia.kind })
    .from(postMedia)
    .where(inArray(postMedia.postId, postIds))
    .orderBy(asc(postMedia.postId), asc(postMedia.position));

  for (const row of rows) {
    byId.get(row.postId)?.push({ url: row.url, thumbUrl: row.thumbUrl, kind: row.kind });
  }
  return byId;
}

/** Media for a single post, in display order. */
export async function mediaForPost(postId: string): Promise<PostMediaItem[]> {
  const rows = await db
    .select({ url: postMedia.url, thumbUrl: postMedia.thumbUrl, kind: postMedia.kind })
    .from(postMedia)
    .where(eq(postMedia.postId, postId))
    .orderBy(asc(postMedia.position));
  return rows;
}

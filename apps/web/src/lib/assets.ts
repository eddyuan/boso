import { isNotNull, sql } from "drizzle-orm";
import { db, pets, placePhotos, postMedia, users } from "@bsocial/db";
import { keyFromUrl, listObjects, type StoredObject } from "./storage";

/**
 * Reconciling what the database references against what storage actually holds.
 *
 * Two different problems wear the same name, and only one of them is visible from
 * either side alone:
 *
 *  - An **orphan** is an object nothing references. The database has forgotten it,
 *    so only the bucket knows. It costs money every month and nothing notices.
 *  - A **dangling reference** is a row pointing at an object that isn't there. The
 *    bucket has forgotten it, so only the database knows. It renders as a broken
 *    image for a real user, which is the worse of the two.
 *
 * These accumulate silently: a failed post after its photos uploaded, an avatar
 * replaced, a deleted post whose media rows cascaded away while the objects
 * stayed. I left two behind myself while testing the upload path.
 *
 * **The bucket is not exclusively ours.** The configured bucket also holds another
 * product's data — audio, voice recordings, wallet assets — and a reconciliation
 * that walked the whole bucket would classify every one of those as an orphan and
 * offer 100+ MB of somebody else's files for deletion. So this only ever considers
 * the prefixes this app writes, and everything else is counted as foreign and left
 * strictly alone. Adding a new `storeImage` prefix means adding it here too.
 */

/** The only prefixes this app writes, and therefore the only ones it may judge. */
export const OWNED_PREFIXES = ["posts/", "places/", "avatars/"] as const;

const isOurs = (key: string) => OWNED_PREFIXES.some((p) => key.startsWith(p));

export type AssetUse = { kind: string; label: string; rows: number; keys: number };

export type Inventory = {
  objects: number;
  bytes: number;
  referenced: number;
  orphans: StoredObject[];
  orphanBytes: number;
  dangling: { kind: string; url: string }[];
  byUse: AssetUse[];
  /** True when the listing hit its ceiling, so "orphan" can't be trusted. */
  truncated: boolean;
  /** Objects in the bucket under prefixes this app doesn't own. Never touched. */
  foreign: { objects: number; bytes: number; prefixes: string[] };
};

const LIST_LIMIT = 5000;

/** Every storage key the database currently points at, by what points at it. */
async function referencedKeys(): Promise<Map<string, string[]>> {
  const [media, photos, avatars, petAvatars] = await Promise.all([
    db.select({ url: postMedia.url, thumbUrl: postMedia.thumbUrl }).from(postMedia),
    db.select({ url: placePhotos.url, thumbUrl: placePhotos.thumbUrl }).from(placePhotos),
    db.select({ url: users.image }).from(users).where(isNotNull(users.image)),
    db.select({ url: pets.avatarUrl }).from(pets).where(isNotNull(pets.avatarUrl)),
  ]);

  const byKey = new Map<string, string[]>();
  const add = (url: string | null, kind: string) => {
    if (!url) return;
    const key = keyFromUrl(url);
    if (!key) return; // An external URL isn't ours to account for.
    byKey.set(key, [...(byKey.get(key) ?? []), kind]);
  };

  for (const m of media) {
    add(m.url, "post media");
    add(m.thumbUrl, "post media");
  }
  for (const p of photos) {
    add(p.url, "venue photo");
    add(p.thumbUrl, "venue photo");
  }
  for (const a of avatars) add(a.url, "avatar");
  for (const a of petAvatars) add(a.url, "pet avatar");

  return byKey;
}

/** What each kind of asset references, for the summary table. */
async function usage(): Promise<AssetUse[]> {
  const [media, photos, avatars, petAvatars] = await Promise.all([
    db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(postMedia),
    db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(placePhotos),
    db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(users).where(isNotNull(users.image)),
    db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(pets).where(isNotNull(pets.avatarUrl)),
  ]);
  return [
    // Post media and venue photos each carry a card and a thumb, so two keys per row.
    { kind: "post_media", label: "Post photos", rows: media[0]?.n ?? 0, keys: (media[0]?.n ?? 0) * 2 },
    { kind: "place_photos", label: "Venue photos", rows: photos[0]?.n ?? 0, keys: (photos[0]?.n ?? 0) * 2 },
    { kind: "avatars", label: "Profile photos", rows: avatars[0]?.n ?? 0, keys: avatars[0]?.n ?? 0 },
    { kind: "pet_avatars", label: "Pet portraits", rows: petAvatars[0]?.n ?? 0, keys: petAvatars[0]?.n ?? 0 },
  ];
}

export async function inventory(): Promise<Inventory> {
  const [all, referenced, byUse] = await Promise.all([listObjects("", LIST_LIMIT), referencedKeys(), usage()]);

  // Split before anything is judged. A foreign object is not an orphan — it is
  // simply none of our business, and conflating the two would offer another
  // product's files for deletion.
  const objects = all.filter((o) => isOurs(o.key));
  const outsiders = all.filter((o) => !isOurs(o.key));

  const present = new Set(objects.map((o) => o.key));
  const orphans = objects.filter((o) => !referenced.has(o.key));

  // The other direction: a row whose object has gone. Checked against the
  // listing rather than by fetching each URL — a HEAD per row would be hundreds
  // of requests, and the listing already says what exists.
  const dangling: { kind: string; url: string }[] = [];
  for (const [key, kinds] of referenced) {
    if (!present.has(key)) dangling.push({ kind: kinds[0]!, url: key });
  }

  return {
    objects: objects.length,
    bytes: objects.reduce((n, o) => n + o.bytes, 0),
    referenced: referenced.size,
    orphans,
    orphanBytes: orphans.reduce((n, o) => n + o.bytes, 0),
    dangling,
    byUse,
    // Judged on the whole listing, not our slice: if the bucket is bigger than
    // one page we can't be sure what's unreferenced even within our prefixes.
    truncated: all.length >= LIST_LIMIT,
    foreign: {
      objects: outsiders.length,
      bytes: outsiders.reduce((n, o) => n + o.bytes, 0),
      prefixes: [...new Set(outsiders.map((o) => o.key.split("/")[0] ?? "(root)"))].sort(),
    },
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

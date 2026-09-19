import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, placePhotos, places } from "@bsocial/db";
import { storeImage } from "./images";
import { fetchPhotoBytes, fetchPlacePhotoRefs, MAX_PHOTOS_PER_PLACE, type PhotoRef } from "./places-google";

/**
 * Turning provider photo handles into images in our own bucket.
 *
 * Split from the place import on purpose. Handles arrive free inside the search
 * response that was already billed; each *image* is a separate billed request,
 * so fetching ten for every venue in a newly imported area would cost roughly a
 * hundred times what importing the area did, mostly for venues nobody looks at.
 * This runs for the venues actually on somebody's screen.
 *
 * As with the text import, a venue is attempted **once**: `photosFetchedAt` is
 * stamped whether or not anything came back, because "this place has no photos"
 * is a real answer and re-asking costs the same as asking.
 *
 * Venues imported before the search asked for photo handles have none at all, so
 * there is an earlier stage: `ensurePhotoRefs` fills them in from Place Details.
 * `photo_refs` carries three distinct states, which is what keeps that cheap —
 * `null` means never asked, `[]` means asked and the venue genuinely has none,
 * and a populated array means there are images to fetch. Without the middle
 * state, a photoless venue would be re-queried on every single view.
 */

/** Venues materialised per call. Ten photos each, so this bounds the spend. */
const PLACES_PER_CALL = 3;
/** Venues we'll ask Details about per call. One billed request each. */
const DETAILS_PER_CALL = 5;

export type PhotoFill = {
  places: number;
  photos: number;
  requests: number;
  /** Venues we looked up handles for, and how many gained some. */
  detailsLookups: number;
  detailsWithPhotos: number;
};

/**
 * Fills in photo handles for venues that have never been asked.
 *
 * Bounded per call and driven by what's on screen, so the whole table gets
 * covered gradually by ordinary use rather than in one paid sweep — and only for
 * venues anyone actually looks at.
 */
async function ensurePhotoRefs(placeIds: string[]): Promise<{ lookups: number; withPhotos: number }> {
  const unasked = await db
    .select({ id: places.id, sourceId: places.sourceId })
    .from(places)
    .where(and(inArray(places.id, placeIds), isNull(places.photoRefs)))
    .orderBy(asc(places.id))
    .limit(DETAILS_PER_CALL);

  let withPhotos = 0;
  for (const place of unasked) {
    const refs = await fetchPlacePhotoRefs(place.sourceId);
    // null is a failure, not an answer: leave it unasked so a transient error
    // doesn't permanently mark a venue as photoless.
    if (refs === null) continue;
    await db.update(places).set({ photoRefs: refs }).where(eq(places.id, place.id));
    if (refs.length > 0) withPhotos++;
  }

  return { lookups: unasked.length, withPhotos };
}

/**
 * Fetches and stores photos for up to `PLACES_PER_CALL` of the given venues that
 * have handles but no images yet. Returns what it actually did.
 */
export async function materializePhotos(placeIds: string[]): Promise<PhotoFill> {
  if (placeIds.length === 0) {
    return { places: 0, photos: 0, requests: 0, detailsLookups: 0, detailsWithPhotos: 0 };
  }

  // Handles first: a venue with none has nothing to materialise, and most of the
  // table predates the search ever asking for them.
  const details = await ensurePhotoRefs(placeIds);

  const pending = await db
    .select({ id: places.id, refs: places.photoRefs })
    .from(places)
    .where(
      and(
        inArray(places.id, placeIds),
        isNull(places.photosFetchedAt),
        // Nothing to do for a venue the provider gave no photos for.
        sql`${places.photoRefs} is not null and jsonb_array_length(${places.photoRefs}) > 0`,
      ),
    )
    .orderBy(asc(places.id))
    .limit(PLACES_PER_CALL);

  let photos = 0;
  let requests = 0;

  for (const place of pending) {
    const refs = (place.refs as PhotoRef[] | null)?.slice(0, MAX_PHOTOS_PER_PLACE) ?? [];

    // Stamped before the downloads, so a crash partway through doesn't leave a
    // venue that gets re-billed on every later view.
    await db.update(places).set({ photosFetchedAt: new Date() }).where(eq(places.id, place.id));

    for (const [position, ref] of refs.entries()) {
      requests++;
      const bytes = await fetchPhotoBytes(ref.name);
      if (!bytes) continue;

      try {
        const stored = await storeImage("places", bytes);
        await db
          .insert(placePhotos)
          .values({
            placeId: place.id,
            url: stored.url,
            thumbUrl: stored.thumbUrl,
            width: stored.width,
            height: stored.height,
            attribution: ref.attribution,
            sourceName: ref.name,
            position,
          })
          // The same handle twice is the same photo; keep the first.
          .onConflictDoNothing();
        photos++;
      } catch (error) {
        console.error("[places] could not store photo", ref.name, error);
      }
    }
  }

  return {
    places: pending.length,
    photos,
    requests,
    detailsLookups: details.lookups,
    detailsWithPhotos: details.withPhotos,
  };
}

export type PlacePhoto = { url: string; thumbUrl: string; attribution: string | null };

/** Photos for a set of venues, in display order. */
export async function photosByPlaceId(placeIds: string[]): Promise<Map<string, PlacePhoto[]>> {
  if (placeIds.length === 0) return new Map();

  const rows = await db
    .select({
      placeId: placePhotos.placeId,
      url: placePhotos.url,
      thumbUrl: placePhotos.thumbUrl,
      attribution: placePhotos.attribution,
    })
    .from(placePhotos)
    .where(inArray(placePhotos.placeId, placeIds))
    .orderBy(asc(placePhotos.placeId), asc(placePhotos.position));

  const byPlace = new Map<string, PlacePhoto[]>();
  for (const row of rows) {
    const list = byPlace.get(row.placeId) ?? [];
    list.push({ url: row.url, thumbUrl: row.thumbUrl, attribution: row.attribution });
    byPlace.set(row.placeId, list);
  }
  return byPlace;
}

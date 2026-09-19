import { and, gte, lte, sql } from "drizzle-orm";
import { db, places } from "@bsocial/db";

/**
 * Places are pulled from the Google Places API (see places-google.ts) and kept
 * in our own table, keyed by Google's place id so re-imports update in place.
 */

export type PlaceCategory = "food" | "drink" | "park" | "shop" | "landmark";

export type Bbox = { west: number; south: number; east: number; north: number };

export type FetchedPlace = {
  sourceId: string;
  name: string;
  category: PlaceCategory;
  latitude: number;
  longitude: number;
  address: string | null;
  /** Provider photo handles, kept for later materialisation. */
  photoRefs?: { name: string; attribution: string | null }[];
};

/** Insert or refresh places, keyed on source + sourceId so re-imports don't duplicate. */
export async function savePlaces(found: FetchedPlace[], source = "google"): Promise<number> {
  if (!found.length) return 0;
  const rows = found.map((place) => ({ ...place, source }));
  // Chunked: a whole city in one statement is megabytes of parameters.
  let written = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    await db
      .insert(places)
      .values(chunk)
      .onConflictDoUpdate({
        target: [places.source, places.sourceId],
        set: {
          name: sql`excluded.name`,
          category: sql`excluded.category`,
          latitude: sql`excluded.latitude`,
          longitude: sql`excluded.longitude`,
          address: sql`excluded.address`,
          // Refreshed on re-import: a venue can gain photos after we first saw it.
          photoRefs: sql`excluded.photo_refs`,
        },
      });
    written += chunk.length;
  }
  return written;
}

/** How many places we already hold in an area — the check before importing more. */
export async function countPlaces(bbox: Bbox): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(places)
    .where(
      and(
        gte(places.latitude, bbox.south),
        lte(places.latitude, bbox.north),
        gte(places.longitude, bbox.west),
        lte(places.longitude, bbox.east),
      ),
    );
  return row?.count ?? 0;
}

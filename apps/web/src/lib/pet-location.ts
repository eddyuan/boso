import { and, eq, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db, mockProfiles, places, users } from "@bsocial/db";
import { getConfig } from "./config";

/**
 * Where a pet's post happens.
 *
 * Pets are the majority of activity, and until now they attached no
 * coordinates — so the map and Nearby only showed the minority of posts written
 * by people, and a new user's first screen was empty.
 *
 * The post lands somewhere random within the pet's 5 km leash of its owner's
 * current position: far enough that the published point says "this
 * neighbourhood" rather than "this address", while still following the owner
 * as they move, which is the point of a local app.
 *
 * The offset is seeded per owner per day rather than drawn fresh each post.
 * A fresh draw every time looks more random but is weaker: the mean of many
 * uniform offsets converges on the true position, so anyone who collected a
 * user's post history could average the blur away. One offset per day can't be
 * averaged down — the whole day's posts move together.
 */

/** The pet's leash on the map (mirrors WANDER_RADIUS_M in the mobile app). */
const SHIFT_RADIUS_M = 5_000;
/**
 * A little scatter on top of the day's offset, drawn fresh per post, so a day's
 * posts don't all stack on one marker. Safe to randomise: averaging these
 * converges on the day's already-shifted point, not on the owner.
 */
const JITTER_M = 250;
/** Snap to a venue within this of the shifted point. */
const PLACE_SNAP_M = 150;
/**
 * Hotspots pull from much further out than an ordinary venue.
 *
 * This is the whole of "pets path toward parks": the wandering you see on the
 * map is cosmetic and client-side, so the only place a preference can actually
 * show up is where posts come to rest. A wider catchment means a marked park or
 * café accumulates posts from a whole neighbourhood's pets instead of one
 * doorstep's worth, which is what makes it read as a gathering spot rather than
 * another pin.
 */
const HOTSPOT_PULL_M = 900;

const COORD_PRECISION = 3;
const coarse = (value: number) => Number(value.toFixed(COORD_PRECISION));
const EARTH_RADIUS_M = 6_371_000;

export type PetPostLocation = {
  latitude: number;
  longitude: number;
  placeId: string | null;
  /** The venue's category, when it snapped to one — treasure finds key off it. */
  placeCategory?: string | null;
};

/** Deterministic [0,1) stream from a string — same seed, same offset all day. */
function seeded(seed: string): () => number {
  let h = createHash("sha256").update(seed).digest().readUInt32BE(0);
  return () => {
    // mulberry32
    h = (h + 0x6d2b79f5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Uniform over the disc, not over (radius, angle) — sampling radius directly
 * would pile two thirds of the posts into the middle third of the circle and
 * give the true position away.
 */
function shiftWithin(
  from: { latitude: number; longitude: number },
  radiusM: number,
  rng: () => number,
) {
  const distance = radiusM * Math.sqrt(rng());
  const bearing = rng() * Math.PI * 2;
  const dLat = (distance * Math.cos(bearing)) / EARTH_RADIUS_M;
  const dLng =
    (distance * Math.sin(bearing)) / (EARTH_RADIUS_M * Math.cos((from.latitude * Math.PI) / 180) || 1);
  return {
    latitude: from.latitude + (dLat * 180) / Math.PI,
    longitude: from.longitude + (dLng * 180) / Math.PI,
  };
}

/** The owner's current position, or a seeded persona's declared neighbourhood. */
async function anchorFor(userId: string): Promise<{ latitude: number; longitude: number } | null> {
  const [row] = await db
    .select({
      lastLatitude: users.lastLatitude,
      lastLongitude: users.lastLongitude,
      mockLatitude: mockProfiles.latitude,
      mockLongitude: mockProfiles.longitude,
    })
    .from(users)
    .leftJoin(mockProfiles, eq(mockProfiles.userId, users.id))
    .where(eq(users.id, userId));
  if (!row) return null;

  // A persona's declared neighbourhood is the entire point of seeding it.
  if (row.mockLatitude !== null && row.mockLongitude !== null) {
    return { latitude: row.mockLatitude, longitude: row.mockLongitude };
  }
  if (row.lastLatitude !== null && row.lastLongitude !== null) {
    return { latitude: row.lastLatitude, longitude: row.lastLongitude };
  }
  return null;
}

/**
 * Resolves coordinates for a post the pet is about to write, or null when we
 * have no idea where its owner is — in which case the post is still written,
 * it just doesn't appear on the map.
 */
export async function resolvePetPostLocation(
  userId: string,
  now: Date = new Date(),
): Promise<PetPostLocation | null> {
  const anchor = await anchorFor(userId);
  if (!anchor) return null;

  const day = now.toISOString().slice(0, 10);
  // One offset per owner per day: a fresh draw each post would look more random
  // but averages back to the true position over a post history.
  const daily = shiftWithin(anchor, SHIFT_RADIUS_M, seeded(`${userId}:${day}`));
  const point = shiftWithin(daily, JITTER_M, Math.random);

  const { values } = await getConfig();
  const pull = values["map.hotspotPullM"] ?? HOTSPOT_PULL_M;
  const snap = values["map.placeSnapM"] ?? PLACE_SNAP_M;

  // A hotspot gets first refusal from much further away; only if there's no
  // marked gathering spot in range does an ordinary neighbour win. A radius of
  // zero disables that tier rather than matching everything.
  const place =
    (pull > 0 ? await nearestPlace(point, pull, true) : null) ??
    (snap > 0 ? await nearestPlace(point, snap, false) : null);

  if (place) {
    // Posts cluster on real venues, which reads far better on the map than a
    // scatter, and matches how a person's own placed post behaves.
    return {
      latitude: coarse(place.latitude),
      longitude: coarse(place.longitude),
      placeId: place.id,
      placeCategory: place.category,
    };
  }

  return { latitude: coarse(point.latitude), longitude: coarse(point.longitude), placeId: null };
}

/**
 * A venue within `radiusM` of a point, or null.
 *
 * The bounding box is there so the index does the work; it's a square around a
 * circle, so the true distance is checked afterwards rather than trusting the
 * box — otherwise a hotspot diagonally 1.4x further than the radius would still
 * win, and the pull distance would quietly mean something other than it says.
 */
async function nearestPlace(
  point: { latitude: number; longitude: number },
  radiusM: number,
  hotspotOnly: boolean,
) {
  const latDelta = (radiusM / EARTH_RADIUS_M) * (180 / Math.PI);
  const lngDelta = latDelta / Math.max(Math.cos((point.latitude * Math.PI) / 180), 0.01);

  const rows = await db
    .select({ id: places.id, latitude: places.latitude, longitude: places.longitude, category: places.category })
    .from(places)
    .where(
      and(
        sql`${places.latitude} between ${point.latitude - latDelta} and ${point.latitude + latDelta}`,
        sql`${places.longitude} between ${point.longitude - lngDelta} and ${point.longitude + lngDelta}`,
        ...(hotspotOnly ? [eq(places.isHotspot, true)] : []),
      ),
    )
    .orderBy(sql`random()`)
    .limit(20);

  const within = rows.filter((r) => metresBetween(point, r) <= radiusM);
  return within[0] ?? null;
}

function metresBetween(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat = ((a.latitude + b.latitude) / 2) * (Math.PI / 180);
  const x = dLng * Math.cos(lat);
  return Math.sqrt(dLat * dLat + x * x) * EARTH_RADIUS_M;
}

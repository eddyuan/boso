import { eq } from "drizzle-orm";
import { db, users } from "@bsocial/db";

/**
 * Where a person currently is.
 *
 * Stored coarse (3 decimals, ~110 m) and overwritten rather than journaled — we
 * keep a position, never a history. It answers every question the product
 * actually asks (who's nearby, where a pet posts from, proximity matching) and
 * is a far smaller thing to lose.
 *
 * Anything that *publishes* a position goes through lib/pet-location.ts, which
 * shifts it randomly within the pet's 5 km leash first. This value itself is
 * never exposed.
 */

/** ~110 m. Same precision people's own posts are stored at. */
const COORD_PRECISION = 3;
const coarse = (value: number) => Number(value.toFixed(COORD_PRECISION));

/** One write per window per user; every location-bearing request calls this. */
const WRITE_INTERVAL_MS = 5 * 60 * 1000;

export type Coords = { latitude: number; longitude: number };

/**
 * Records a position seen on an authenticated request. Throttled, and safe to
 * call from any route that already receives coordinates — the apps don't need
 * to report location separately.
 */
export async function recordLocation(userId: string, latitude: number, longitude: number): Promise<void> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return;

  const [current] = await db
    .select({ lastLocationAt: users.lastLocationAt })
    .from(users)
    .where(eq(users.id, userId));
  if (!current) return;

  const since = current.lastLocationAt ? Date.now() - current.lastLocationAt.getTime() : Infinity;
  if (since <= WRITE_INTERVAL_MS) return;

  await db
    .update(users)
    .set({
      lastLatitude: coarse(latitude),
      lastLongitude: coarse(longitude),
      lastLocationAt: new Date(),
    })
    .where(eq(users.id, userId));
}

const EARTH_RADIUS_KM = 6371;

export function distanceKm(a: Coords, b: Coords): number {
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Stale positions are worse than none for proximity — don't match on them. */
export const LOCATION_FRESH_DAYS = 14;

export function isFresh(at: Date | null): boolean {
  if (!at) return false;
  return Date.now() - at.getTime() < LOCATION_FRESH_DAYS * 86_400_000;
}

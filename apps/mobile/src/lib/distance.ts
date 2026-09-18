const EARTH_RADIUS_M = 6_371_000;

type Point = { latitude: number; longitude: number };

/** Great-circle distance in metres. */
export function distanceBetween(a: Point, b: Point): number {
  const toRad = Math.PI / 180;
  const lat1 = a.latitude * toRad;
  const lat2 = b.latitude * toRad;
  const dLat = lat2 - lat1;
  const dLng = (b.longitude - a.longitude) * toRad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * "12 m", "320 m", "1.2 km" — rounded coarsely on purpose, both because the
 * precision would be false and because a jittering number is distracting.
 */
export function formatDistance(metres: number): string {
  if (metres < 100) return `${Math.max(1, Math.round(metres / 5) * 5)} m`;
  // Round first, so 999 m reads as "1.0 km" rather than "1000 m".
  const rounded = Math.round(metres / 10) * 10;
  return rounded < 1000 ? `${rounded} m` : `${(metres / 1000).toFixed(1)} km`;
}

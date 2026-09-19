// Only the geometry lives here. Formatting a distance moved to the shared i18n
// runtime, because it depends on the reader's region — see lib/i18n.tsx.
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

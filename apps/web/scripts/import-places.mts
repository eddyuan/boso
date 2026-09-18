/**
 * Imports places for a bounding box from the Google Places API.
 *
 *   tsx scripts/import-places.mts <west> <south> <east> <north> [--budget N] [--radius M]
 *   tsx scripts/import-places.mts --toronto
 *
 * Needs GOOGLE_PLACES_API_KEY. Nearby Search returns 20 results per billed
 * call, so --budget caps how much a single run can spend.
 *
 * The app fills areas on demand too; this is for seeding a city by hand and for
 * checking what a box actually yields before wiring it to a job.
 */
import "./lib/load-env.mjs";
import { countPlaces, savePlaces, type Bbox } from "../src/lib/places.js";
import { fetchPlacesGoogle } from "../src/lib/places-google.js";

const PRESETS: Record<string, Bbox> = {
  // Downtown Toronto, roughly Bathurst→Jarvis and the lake→Bloor.
  toronto: { west: -79.42, south: 43.63, east: -79.36, north: 43.68 },
};

const args = process.argv.slice(2);
const budgetArg = args.indexOf("--budget");
const maxRequests = budgetArg >= 0 ? Number(args[budgetArg + 1]) : 60;
// Bigger circles cover more ground per billed call. Fine where places are
// sparse; in a dense block the 20-result cap starts losing places.
const radiusArg = args.indexOf("--radius");
const cellRadiusM = radiusArg >= 0 ? Number(args[radiusArg + 1]) : 400;
const preset = args.find((a) => a.startsWith("--") && !["--budget", "--radius"].includes(a))?.replace("--", "");
const coords = args.filter(
  (a) => !a.startsWith("--") && !Number.isNaN(Number(a)) && a !== String(maxRequests) && a !== String(cellRadiusM),
);
const bbox: Bbox | undefined = preset
  ? PRESETS[preset]
  : coords.length >= 4
    ? { west: Number(coords[0]), south: Number(coords[1]), east: Number(coords[2]), north: Number(coords[3]) }
    : undefined;

if (!bbox || Object.values(bbox).some(Number.isNaN)) {
  console.error("usage: tsx scripts/import-places.mts <west> <south> <east> <north> | --toronto");
  process.exit(1);
}

console.log("bbox:", bbox);
const before = await countPlaces(bbox);
console.log(`already held here: ${before}`);

const source = "google";
if (!process.env.GOOGLE_PLACES_API_KEY) {
  console.error(
    "GOOGLE_PLACES_API_KEY is not set.\n" +
      "Add it to apps/web/.env.local, then re-run. The key needs the Places API (New) enabled.",
  );
  process.exit(1);
}
console.time(source);
const result = await fetchPlacesGoogle(bbox, { maxRequests, cellRadiusM });
console.log(
  `billed requests: ${result.requests}` +
    (result.failed ? `, ${result.failed} failed` : "") +
    (result.truncated ? " (budget reached — box not fully covered)" : ""),
);
const found = result.places;
console.timeEnd(source);

const byCategory = found.reduce<Record<string, number>>((acc, place) => {
  acc[place.category] = (acc[place.category] ?? 0) + 1;
  return acc;
}, {});
console.log(`found ${found.length}:`, byCategory);
console.log("examples:", found.slice(0, 5).map((p) => `${p.name} (${p.category})`));

const written = await savePlaces(found, source);
const after = await countPlaces(bbox);
console.log(`wrote ${written}; area now holds ${after} (was ${before})`);
process.exit(0);

/**
 * Fills an area with stray pets and the posts they write about nearby places.
 *
 *   tsx scripts/seed-posts.mts <west> <south> <east> <north> [--count N] [--strays N] [--images N]
 *   tsx scripts/seed-posts.mts --clear        remove every seeded account and its posts
 *
 * Needs GOOGLE_GENERATIVE_AI_API_KEY (or whichever provider PET_AI_MODEL names)
 * and places already imported for the area — see import-places.mts.
 */
import "./lib/load-env.mjs";
import { countPostsIn, deleteStrays, seedPostsForArea } from "../src/lib/seed.js";
import type { Bbox } from "../src/lib/places.js";

const args = process.argv.slice(2);

if (args.includes("--clear")) {
  const gone = await deleteStrays();
  console.log(`removed ${gone} stray accounts (their pets and posts went with them)`);
  process.exit(0);
}

const numeric = (flag: string, fallback: number) => {
  const i = args.indexOf(flag);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const count = numeric("--count", 20);
const strayCount = numeric("--strays", 6);
// Images cost a lot more than the text, so they're opt-in and capped.
const withImages = numeric("--images", 0);

const coords = args.filter((a) => !a.startsWith("--") && !Number.isNaN(Number(a)));
if (coords.length < 4) {
  console.error("usage: tsx scripts/seed-posts.mts <west> <south> <east> <north> [--count N] [--strays N]");
  process.exit(1);
}
const bbox: Bbox = {
  west: Number(coords[0]),
  south: Number(coords[1]),
  east: Number(coords[2]),
  north: Number(coords[3]),
};

console.log("bbox:", bbox);
console.log("posts here before:", await countPostsIn(bbox));

console.time("generation");
const result = await seedPostsForArea(bbox, { count, strayCount, withImages });
console.timeEnd("generation");

console.log(
  `wrote ${result.written} (${result.images} with a photo), skipped ${result.skipped}, using ${result.strays} strays`,
);
console.log("posts here now:", await countPostsIn(bbox));
process.exit(0);

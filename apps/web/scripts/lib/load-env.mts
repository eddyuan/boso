/**
 * Loads apps/web/.env.local into process.env.
 *
 * Imported first — before anything that reads env at module load, like
 * lib/storage.ts — so scripts can just be run with `npx tsx scripts/...`
 * instead of every variable being passed on the command line.
 */
import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), ".env.local");
if (fs.existsSync(file)) {
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    const [, key, raw] = match;
    const value = raw.replace(/^["'](.*)["']$/, "$1");
    // Anything already in the environment wins, so one-off overrides still work.
    if (value && !(key in process.env)) process.env[key] = value;
  }
}

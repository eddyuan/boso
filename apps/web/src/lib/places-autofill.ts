import { eq, gt, sql } from "drizzle-orm";
import { db, placeImports } from "@bsocial/db";
import { getConfig } from "./config";
import { countPlaces, savePlaces, type Bbox } from "./places";
import { fetchPlacesGoogle } from "./places-google";

/**
 * Filling in a neighbourhood nobody has imported yet.
 *
 * This is the other half of showing places when there are no posts: that only
 * helps where places exist, and the table only covers areas someone imported by
 * hand. Two of the first three real users in this database had no venue within
 * 5 km of them, so for them the fallback showed exactly as much as no fallback.
 *
 * **Every request here costs money**, and `fetchPlacesGoogle` bills once per
 * category per search circle — five per circle. So the guards are the design:
 *
 *  - An area is asked about **once, ever**. The cell is claimed in the ledger
 *    before the first call, so concurrent map loads can't both pay for it, and a
 *    failed import doesn't invite a retry that spends again.
 *  - A **coarse grid**, because no two viewports are alike and a cache keyed on
 *    viewports would never hit.
 *  - A **per-cell budget** and a **daily cell cap**, so a bug or a bored user
 *    panning across a continent has a bounded worst case.
 *  - An **off switch** that doesn't need a deploy to reach.
 */

/** ~2.2 km at the equator. Small enough that one fill covers what a map shows. */
const CELL_DEGREES = 0.02;
/**
 * Billed requests per cell. At 5 categories per circle this is 4 circles — a
 * couple of dollars' worth at most, once, for a neighbourhood that had nothing.
 */
const MAX_REQUESTS_PER_CELL = 20;
/** Wide circles: fewer billed calls for the same ground, at some loss in dense blocks. */
const CELL_RADIUS_M = 1_000;
/** Runaway guard. The worst case is this many cells' spend in any 24 hours. */
const MAX_CELLS_PER_DAY = 30;
/** Below this many venues in view, an area is worth filling. */
export const SPARSE_THRESHOLD = 8;

export type FillOutcome =
  | { filled: true; found: number; requests: number }
  | { filled: false; reason: "disabled" | "already_tried" | "daily_cap" | "not_sparse" | "no_api_key" | "failed" };

/** Stable cell id for a point. */
export function cellFor(latitude: number, longitude: number): string {
  const round = (v: number) => (Math.floor(v / CELL_DEGREES) * CELL_DEGREES).toFixed(3);
  return `${round(latitude)},${round(longitude)}`;
}

/** The box a cell covers, which is what actually gets imported. */
function cellBbox(cell: string): Bbox {
  const [lat, lng] = cell.split(",").map(Number) as [number, number];
  return { south: lat, west: lng, north: lat + CELL_DEGREES, east: lng + CELL_DEGREES };
}

/**
 * Imports venues for the cell containing a point, unless any guard says no.
 *
 * Returns why it declined rather than a bare false: "we already tried here and
 * there is genuinely nothing" and "we refused to spend more today" look the same
 * to a caller otherwise, and only one of them is worth retrying later.
 */
export async function fillAreaFor(latitude: number, longitude: number): Promise<FillOutcome> {
  if (process.env.PLACES_AUTOFILL === "off") return { filled: false, reason: "disabled" };
  if (!process.env.GOOGLE_PLACES_API_KEY) return { filled: false, reason: "no_api_key" };

  const { values } = await getConfig();
  const cellsPerDay = values["cost.autofillCellsPerDay"] ?? MAX_CELLS_PER_DAY;
  const requestsPerCell = values["cost.autofillRequestsPerCell"] ?? MAX_REQUESTS_PER_CELL;
  // A ceiling of zero is a deliberate stop, not a misconfiguration.
  if (cellsPerDay === 0) return { filled: false, reason: "daily_cap" };

  const cell = cellFor(latitude, longitude);
  const bbox = cellBbox(cell);

  // Cheap checks before the ledger: an area that already has venues needs
  // nothing, whoever put them there.
  if ((await countPlaces(bbox)) >= SPARSE_THRESHOLD) return { filled: false, reason: "not_sparse" };

  const dayAgo = new Date(Date.now() - 86_400_000);
  const [spent] = await db
    .select({ cells: sql<number>`count(*)`.mapWith(Number) })
    .from(placeImports)
    .where(gt(placeImports.createdAt, dayAgo));
  if ((spent?.cells ?? 0) >= cellsPerDay) return { filled: false, reason: "daily_cap" };

  // Claim the cell. onConflictDoNothing is what makes this safe under
  // concurrency: whoever inserts the row owns the spend, everyone else backs off.
  const claimed = await db
    .insert(placeImports)
    .values({ cell })
    .onConflictDoNothing()
    .returning({ cell: placeImports.cell });
  if (claimed.length === 0) return { filled: false, reason: "already_tried" };

  try {
    const result = await fetchPlacesGoogle(bbox, {
      maxRequests: requestsPerCell,
      cellRadiusM: CELL_RADIUS_M,
    });
    const written = await savePlaces(result.places);
    await db
      .update(placeImports)
      .set({ requests: result.requests, found: written, completedAt: new Date() })
      .where(eq(placeImports.cell, cell));
    return { filled: true, found: written, requests: result.requests };
  } catch (error) {
    console.error("[places] autofill failed for", cell, error);
    // The claim stays. A cell that errored once is not worth paying to retry on
    // the next pan; an admin can clear the row deliberately.
    return { filled: false, reason: "failed" };
  }
}

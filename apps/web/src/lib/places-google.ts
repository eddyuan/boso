import type { Bbox, FetchedPlace, PlaceCategory } from "./places";

/**
 * Places from the Google Places API (New).
 *
 * Nearby Search returns at most 20 results per call, so covering an area means
 * tiling it with small circles and asking per category — requests add up fast
 * and each one is billed. `importArea` therefore takes an explicit request
 * budget and reports what it spent.
 */
const SEARCH_URL = "https://places.googleapis.com/v1/places:searchNearby";
const MAX_RESULTS_PER_CALL = 20;
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.primaryType",
  "places.types",
].join(",");

/** Google's place types (Table A), grouped into the five categories the app shows. */
const TYPES: Record<PlaceCategory, string[]> = {
  food: ["restaurant", "meal_takeaway", "bakery", "ice_cream_shop", "sandwich_shop", "pizza_restaurant"],
  drink: ["cafe", "coffee_shop", "bar", "pub", "wine_bar"],
  park: ["park", "dog_park", "national_park", "garden"],
  shop: ["supermarket", "convenience_store", "clothing_store", "book_store", "shopping_mall", "grocery_store"],
  landmark: ["tourist_attraction", "museum", "art_gallery", "library", "movie_theater", "historical_landmark"],
};

type GooglePlace = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  primaryType?: string;
  types?: string[];
};

function categoryOf(place: GooglePlace): PlaceCategory | null {
  const all = [place.primaryType, ...(place.types ?? [])].filter(Boolean) as string[];
  for (const [category, types] of Object.entries(TYPES) as [PlaceCategory, string[]][]) {
    if (all.some((t) => types.includes(t))) return category;
  }
  return null;
}

const RETRY_DELAYS_MS = [500, 1500, 4000];

async function searchNearbyOnce(
  apiKey: string,
  center: { latitude: number; longitude: number },
  radiusM: number,
  includedTypes: string[],
): Promise<GooglePlace[]> {
  const response = await fetch(SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      includedTypes,
      maxResultCount: MAX_RESULTS_PER_CALL,
      locationRestriction: { circle: { center, radius: radiusM } },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    const error = new Error(`google places ${response.status}: ${detail.slice(0, 200)}`);
    // Rate limits and Google's own hiccups are worth another go; a bad key or
    // a malformed request never will be.
    (error as { retryable?: boolean }).retryable = response.status === 429 || response.status >= 500;
    throw error;
  }
  const data = (await response.json()) as { places?: GooglePlace[] };
  return data.places ?? [];
}

/** One search, retried through transient failures. */
async function searchNearby(
  apiKey: string,
  center: { latitude: number; longitude: number },
  radiusM: number,
  includedTypes: string[],
): Promise<GooglePlace[]> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await searchNearbyOnce(apiKey, center, radiusM, includedTypes);
    } catch (error) {
      lastError = error;
      const retryable = (error as { retryable?: boolean }).retryable ?? true;
      if (!retryable || attempt === RETRY_DELAYS_MS.length) break;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    }
  }
  throw lastError;
}

export type GoogleImportOptions = {
  /** Radius of each search circle. Smaller catches more in dense areas, at more requests. */
  cellRadiusM?: number;
  /** Hard stop on billed requests, so a big box can't run away with your spend. */
  maxRequests?: number;
  categories?: PlaceCategory[];
};

export type GoogleImportResult = {
  places: FetchedPlace[];
  requests: number;
  /** True when the budget stopped us before covering the box. */
  truncated: boolean;
  /** Calls that failed even after retries. Their places are simply missing. */
  failed: number;
};

/** Tile a bounding box with search circles and collect everything inside it. */
export async function fetchPlacesGoogle(bbox: Bbox, options: GoogleImportOptions = {}): Promise<GoogleImportResult> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY is not set");

  const { cellRadiusM = 400, maxRequests = 60, categories = Object.keys(TYPES) as PlaceCategory[] } = options;

  // Circle centres spaced so their coverage overlaps slightly (√2 apart would
  // leave gaps at the corners of each square cell).
  const stepM = cellRadiusM * 1.3;
  const latStep = (stepM / 111_320) ;
  const midLat = (bbox.north + bbox.south) / 2;
  const lngStep = stepM / (111_320 * Math.max(Math.cos((midLat * Math.PI) / 180), 0.01));

  const found = new Map<string, FetchedPlace>();
  let requests = 0;
  let truncated = false;
  let failed = 0;

  for (let lat = bbox.south; lat <= bbox.north && !truncated; lat += latStep) {
    for (let lng = bbox.west; lng <= bbox.east && !truncated; lng += lngStep) {
      for (const category of categories) {
        if (requests >= maxRequests) {
          truncated = true;
          break;
        }
        requests++;
        let results: GooglePlace[];
        try {
          results = await searchNearby(apiKey, { latitude: lat, longitude: lng }, cellRadiusM, TYPES[category]);
        } catch (error) {
          // One bad cell shouldn't throw away everything already collected and
          // paid for — note it and carry on.
          failed++;
          console.warn(`[places] ${category} at ${lat.toFixed(4)},${lng.toFixed(4)} failed:`, (error as Error).message);
          continue;
        }
        for (const place of results) {
          const name = place.displayName?.text?.trim();
          if (!name || !place.location) continue;
          found.set(place.id, {
            sourceId: place.id,
            name,
            category: categoryOf(place) ?? category,
            latitude: place.location.latitude,
            longitude: place.location.longitude,
            address: place.formattedAddress ?? null,
          });
        }
      }
    }
  }

  return { places: [...found.values()], requests, truncated, failed };
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { materializePhotos, photosByPlaceId } from "@/lib/place-photos";
import { requireSession } from "@/lib/session";

/**
 * Fetch and store photos for venues currently on screen.
 *
 * Driven by the client rather than done at import time because each image is a
 * separate billed request: ten per venue across a freshly imported area would
 * cost about a hundred times the import, mostly for venues nobody opens. Called
 * with the ids in view, it fills a few per call and returns everything it has —
 * so repeated calls converge on the visible map.
 */
export async function POST(req: Request) {
  const { response } = await requireSession();
  if (response) return response;

  const parsed = z
    .object({ placeIds: z.array(z.string().uuid()).min(1).max(40) })
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const filled = await materializePhotos(parsed.data.placeIds);
  const photos = await photosByPlaceId(parsed.data.placeIds);

  return NextResponse.json({
    filled,
    photos: Object.fromEntries(photos),
  });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { fillAreaFor } from "@/lib/places-autofill";
import { requireSession } from "@/lib/session";

/**
 * Import venues for a quiet area, on demand.
 *
 * Kept separate from `GET /api/map/places` so the map renders immediately with
 * whatever exists and fills afterwards. Folding it into the GET would block the
 * first paint for as long as Google takes, and a timeout there would leave the
 * user with nothing rather than with a map.
 *
 * Billed, and guarded accordingly — see lib/places-autofill.ts. The response
 * says which guard declined, so the client can tell "nothing here" from
 * "we didn't look".
 */
export async function POST(req: Request) {
  const { response } = await requireSession();
  if (response) return response;

  const parsed = z
    .object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) })
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const outcome = await fillAreaFor(parsed.data.latitude, parsed.data.longitude);
  return NextResponse.json(outcome);
}

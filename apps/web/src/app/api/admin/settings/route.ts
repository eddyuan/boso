import { NextResponse } from "next/server";
import { z } from "zod";
import { getSettings, setSetting } from "@/lib/settings";
import { requireSession } from "@/lib/session";

export async function GET() {
  const { session, response } = await requireSession({ requireAdmin: true });
  if (response) return response;
  void session;

  return NextResponse.json({ settings: await getSettings() });
}

const patchSchema = z.object({
  petsPaused: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  const { session, response } = await requireSession({ requireAdmin: true });
  if (response) return response;
  void session;

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  if (parsed.data.petsPaused !== undefined) {
    await setSetting("petsPaused", parsed.data.petsPaused);
  }

  return NextResponse.json({ settings: await getSettings() });
}

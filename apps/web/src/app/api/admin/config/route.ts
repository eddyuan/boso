import { NextResponse } from "next/server";
import { z } from "zod";
import { CONFIG_FIELDS, CONFIG_GROUPS } from "@bsocial/shared";
import { configHistory, getConfig, resetConfigValue, setConfigValue } from "@/lib/config";
import { requireSession } from "@/lib/session";

/**
 * Reading and writing the live tuning values.
 *
 * The registry travels with the response rather than being duplicated in the
 * page: bounds and help text belong next to the value they describe, and a copy
 * in the client is a copy that goes stale.
 */
export async function GET() {
  const { response } = await requireSession({ requireAdmin: true });
  if (response) return response;

  const [{ values, issues }, history] = await Promise.all([getConfig(), configHistory()]);
  return NextResponse.json({
    fields: CONFIG_FIELDS,
    groups: CONFIG_GROUPS,
    values,
    // Stored values the registry refused. Surfaced rather than silently
    // defaulted, so a bad row is visible instead of merely inert.
    issues,
    history,
  });
}

const patchSchema = z.object({
  key: z.string().min(1).max(120),
  /** null resets the key to its shipped default. */
  value: z.number().finite().nullable(),
});

export async function PATCH(req: Request) {
  const { session, response } = await requireSession({ requireAdmin: true });
  if (response) return response;

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { key, value } = parsed.data;

  const result =
    value === null
      ? await resetConfigValue(key, session.user.id)
      : await setConfigValue(key, value, session.user.id);

  if (!result.ok) return NextResponse.json({ error: "rejected", reason: result.reason }, { status: 400 });

  const [{ values }, history] = await Promise.all([getConfig(), configHistory()]);
  return NextResponse.json({ ok: true, values, history });
}

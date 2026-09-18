import { NextResponse } from "next/server";
import { z } from "zod";
import { db, pushTokens } from "@bsocial/db";
import { requireSession } from "@/lib/session";

const bodySchema = z.object({
  token: z.string().regex(/^Expo(nent)?PushToken\[.+\]$/),
  platform: z.enum(["ios", "android"]),
});

// Register this device's Expo push token. A token belongs to one install, so
// if another account signed in on the device, it moves to the current user.
export async function POST(req: Request) {
  const { session, response } = await requireSession({ allowIncompleteOnboarding: true });
  if (response) return response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  await db
    .insert(pushTokens)
    .values({ userId: session.user.id, ...parsed.data })
    .onConflictDoUpdate({
      target: pushTokens.token,
      set: { userId: session.user.id, platform: parsed.data.platform },
    });

  return NextResponse.json({ ok: true }, { status: 201 });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/session";
import { createStrays, deleteStrays, listStrays } from "@/lib/seed";

export async function GET() {
  const { session, response } = await requireSession({ requireAdmin: true });
  if (response) return response;
  void session;

  const strays = await listStrays();
  return NextResponse.json({ strays });
}

const createSchema = z.object({ count: z.coerce.number().int().min(1).max(50) });

export async function POST(req: Request) {
  const { session, response } = await requireSession({ requireAdmin: true });
  if (response) return response;
  void session;

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const created = await createStrays(parsed.data.count);
  return NextResponse.json({ created: created.length });
}

export async function DELETE() {
  const { session, response } = await requireSession({ requireAdmin: true });
  if (response) return response;
  void session;

  const removed = await deleteStrays();
  return NextResponse.json({ removed });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/session";
import { seedPostsForArea } from "@/lib/seed";

const seedSchema = z.object({
  west: z.coerce.number().min(-180).max(180),
  south: z.coerce.number().min(-90).max(90),
  east: z.coerce.number().min(-180).max(180),
  north: z.coerce.number().min(-90).max(90),
  count: z.coerce.number().int().min(1).max(100).default(20),
  strayCount: z.coerce.number().int().min(1).max(20).default(6),
  withImages: z.coerce.number().int().min(0).max(50).default(0),
});

export async function POST(req: Request) {
  const { session, response } = await requireSession({ requireAdmin: true });
  if (response) return response;
  void session;

  const body = await req.json().catch(() => ({}));
  const parsed = seedSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });

  const { west, south, east, north, count, strayCount, withImages } = parsed.data;
  const result = await seedPostsForArea(
    { west, south, east, north },
    { count, strayCount, withImages },
  );

  return NextResponse.json(result);
}

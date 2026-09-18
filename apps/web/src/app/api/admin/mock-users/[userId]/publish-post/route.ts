import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, pets, posts, users } from "@bsocial/db";
import { requireSession } from "@/lib/session";
import { attachPostMedia, MAX_POST_MEDIA } from "@/lib/post-media";

const mediaSchema = z.object({
  url: z.string().url().max(2048),
  thumbUrl: z.string().url().max(2048).optional(),
  kind: z.enum(["image", "video"]).default("image"),
});

const bodySchema = z.object({
  content: z.string().trim().min(1).max(500),
  media: z.array(mediaSchema).max(MAX_POST_MEDIA).default([]),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { session, response } = await requireSession({ requireAdmin: true });
  if (response) return response;
  void session;

  const { userId } = await params;

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { content, media, latitude, longitude } = parsed.data;

  // Fetch pet for this mock user
  const [pet] = await db.select({ id: pets.id }).from(pets).where(eq(pets.userId, userId));
  if (!pet) {
    return NextResponse.json({ error: "no_pet" }, { status: 404 });
  }

  const [post] = await db
    .insert(posts)
    .values({
      petId: pet.id,
      content,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      authoredByAgent: true,
    })
    .returning();

  await attachPostMedia(post!.id, media);
  await db.update(users).set({ lastActiveAt: new Date() }).where(eq(users.id, userId));

  return NextResponse.json({ post: { ...post, media } }, { status: 201 });
}

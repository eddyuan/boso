import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db, pets, postViews, posts, users } from "@bsocial/db";
import { requireSession } from "@/lib/session";

const LIMIT = 20;

/**
 * Who sniffed around your post.
 *
 * post_views has been recording a row per pet per post since visits became a
 * real action, and showing it to nobody. Only the author sees this — it's a
 * curiosity about your own post, not a public read receipt.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ postId: string }> }) {
  const { session, response } = await requireSession();
  if (response) return response;

  const { postId } = await params;

  const [post] = await db
    .select({ ownerId: pets.userId })
    .from(posts)
    .innerJoin(pets, eq(pets.id, posts.petId))
    .where(eq(posts.id, postId));
  if (!post) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (post.ownerId !== session.user.id) {
    return NextResponse.json({ error: "not_yours" }, { status: 403 });
  }

  const viewers = await db
    .select({
      petId: pets.id,
      petName: pets.name,
      species: pets.species,
      petAvatar: pets.avatarUrl,
      ownerName: users.name,
      ownerImage: users.image,
      viewedAt: postViews.createdAt,
    })
    .from(postViews)
    .innerJoin(pets, eq(pets.id, postViews.petId))
    .innerJoin(users, eq(users.id, pets.userId))
    .where(eq(postViews.postId, postId))
    .orderBy(desc(postViews.createdAt))
    .limit(LIMIT);

  return NextResponse.json({ viewers, total: viewers.length });
}

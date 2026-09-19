import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { storeImage } from "@/lib/images";
import { sniffImageType } from "@/lib/image-sniff";

/**
 * A photo for a post.
 *
 * Phone cameras send 8–12 MB originals, so nothing here stores what arrives:
 * `storeImage` re-encodes to a card-width and a thumb-width WebP, and only those
 * two URLs are ever handed back. The client then passes them to `POST /api/posts`
 * as a `media[]` entry — upload and publish stay separate so a failed post
 * doesn't lose the photo, and a photo can be swapped before publishing.
 */

/** Generous enough for an unprocessed phone photo, since we re-encode anyway. */
const MAX_BYTES = 15 * 1024 * 1024;

export async function POST(req: Request) {
  const { response } = await requireSession();
  if (response) return response;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof Blob)) return NextResponse.json({ error: "file_required" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "file_too_large" }, { status: 413 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  // The declared content type is the client's claim; the first bytes are
  // evidence. Only what we can actually decode gets as far as sharp.
  if (!sniffImageType(bytes)) return NextResponse.json({ error: "unsupported_image_type" }, { status: 415 });

  const stored = await storeImage("posts", bytes);
  return NextResponse.json(
    { url: stored.url, thumbUrl: stored.thumbUrl, width: stored.width, height: stored.height, kind: "image" },
    { status: 201 },
  );
}

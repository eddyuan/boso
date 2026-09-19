import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { storeAvatar } from "@/lib/images";
import { sniffImageType } from "@/lib/image-sniff";

const MAX_BYTES = 5 * 1024 * 1024;

// Profile photo upload (multipart form field "file"). Returns the public URL,
// which the client then saves via the onboarding profile step.
export async function POST(req: Request) {
  const { response } = await requireSession({ allowIncompleteOnboarding: true });
  if (response) return response;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof Blob)) return NextResponse.json({ error: "file_required" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "file_too_large" }, { status: 413 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!sniffImageType(bytes)) return NextResponse.json({ error: "unsupported_image_type" }, { status: 415 });

  // Sniffing still guards what we hand to the encoder; the stored file is
  // always a small square WebP, never the multi-megabyte original.
  const { url } = await storeAvatar(bytes);
  return NextResponse.json({ url }, { status: 201 });
}

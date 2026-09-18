import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { storeAvatar } from "@/lib/images";

const MAX_BYTES = 5 * 1024 * 1024;

// Detect the real type from the file's first bytes rather than trusting the
// client-supplied content type.
function sniffImageType(bytes: Uint8Array): { contentType: string } | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { contentType: "image/jpeg" };
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { contentType: "image/png" };
  }
  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const webp = String.fromCharCode(...bytes.slice(8, 12));
  if (riff === "RIFF" && webp === "WEBP") return { contentType: "image/webp" };
  return null;
}

// Profile photo upload (multipart form field "file"). Returns the public URL,
// which the client then saves via the onboarding profile step.
export async function POST(req: Request) {
  const { session, response } = await requireSession({ allowIncompleteOnboarding: true });
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

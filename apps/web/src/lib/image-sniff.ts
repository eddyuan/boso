/**
 * What an upload actually is, judged from its first bytes.
 *
 * The client's `Content-Type` is a claim, not evidence — it's trivially forged,
 * and a mislabelled file is the cheapest way to get something unexpected as far
 * as an image decoder. Shared by every upload endpoint so they can't drift into
 * accepting different sets.
 */
export function sniffImageType(bytes: Uint8Array): { contentType: string } | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { contentType: "image/jpeg" };
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { contentType: "image/png" };
  }
  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const webp = String.fromCharCode(...bytes.slice(8, 12));
  if (riff === "RIFF" && webp === "WEBP") return { contentType: "image/webp" };
  return null;
}

import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { putObject } from "./storage";

/**
 * Everything image-shaped goes through here on the way in, so the app never
 * serves an original.
 *
 * A generated photo arrives as a ~1.9 MB PNG and a phone camera can send 10 MB;
 * either would be downloaded in full to draw a 52px map marker. We derive a
 * couple of WebP sizes at upload time — once, while we're already waiting on a
 * generation or an upload — and serve those instead.
 */

/** Wide enough for a full-width card at 3x on a phone. */
const CARD_WIDTH = 1200;
/** Map markers and avatars: 52–88px on screen, so 256 covers 3x. */
const THUMB_WIDTH = 256;
const QUALITY = 78;

export type StoredImage = { url: string; thumbUrl: string; width: number; height: number; bytes: number };

/**
 * Resize, re-encode and upload. `prefix` groups the variants together in the
 * bucket ("posts", "avatars"), and both sizes share an id so they can be found
 * and deleted as a pair.
 */
export async function storeImage(prefix: string, input: Uint8Array | Buffer): Promise<StoredImage> {
  const source = sharp(Buffer.from(input), { failOn: "none" }).rotate(); // rotate() honours EXIF orientation
  const meta = await source.metadata();

  const card = await source
    .clone()
    .resize({ width: CARD_WIDTH, withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toBuffer();
  const thumb = await source
    .clone()
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toBuffer();

  const id = randomUUID();
  const [url, thumbUrl] = await Promise.all([
    putObject(`${prefix}/${id}.webp`, new Uint8Array(card), "image/webp"),
    putObject(`${prefix}/${id}-thumb.webp`, new Uint8Array(thumb), "image/webp"),
  ]);

  return {
    url,
    thumbUrl,
    width: Math.min(meta.width ?? CARD_WIDTH, CARD_WIDTH),
    height: meta.height ?? 0,
    bytes: card.byteLength,
  };
}

/** A square crop, for avatars. */
export async function storeAvatar(input: Uint8Array | Buffer): Promise<StoredImage> {
  const square = await sharp(Buffer.from(input), { failOn: "none" })
    .rotate()
    .resize({ width: THUMB_WIDTH, height: THUMB_WIDTH, fit: "cover", position: "attention" })
    .webp({ quality: QUALITY })
    .toBuffer();
  const id = randomUUID();
  const url = await putObject(`avatars/${id}.webp`, new Uint8Array(square), "image/webp");
  return { url, thumbUrl: url, width: THUMB_WIDTH, height: THUMB_WIDTH, bytes: square.byteLength };
}

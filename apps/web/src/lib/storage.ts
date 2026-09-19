import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { AwsClient } from "aws4fetch";

const env = process.env;

/**
 * S3-compatible object storage (AWS S3, Cloudflare R2, MinIO...). Uploaded
 * objects are served from S3_PUBLIC_URL (a public bucket domain or CDN).
 *
 * S3_ENDPOINT is only needed for non-AWS services; on AWS it's derived from the
 * region, so requiring it would silently fall back to local disk.
 */
/**
 * Treats blank as absent throughout.
 *
 * A variable that exists but is empty is the normal state of a half-filled
 * .env, and it used to defeat this file: `S3_ENDPOINT=` left `endpoint` as ""
 * (optional chaining doesn't short-circuit on a string, and ?? doesn't fall back
 * from one), which is falsy, so a fully configured bucket silently wrote to
 * local disk instead.
 */
const set = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const endpoint =
  set(env.S3_ENDPOINT)?.replace(/\/$/, "") ??
  (set(env.S3_REGION) ? `https://s3.${set(env.S3_REGION)}.amazonaws.com` : undefined);

const s3 =
  endpoint && set(env.S3_BUCKET) && set(env.S3_ACCESS_KEY_ID) && set(env.S3_SECRET_ACCESS_KEY) && set(env.S3_PUBLIC_URL)
    ? {
        client: new AwsClient({
          accessKeyId: set(env.S3_ACCESS_KEY_ID)!,
          secretAccessKey: set(env.S3_SECRET_ACCESS_KEY)!,
          region: set(env.S3_REGION) ?? "auto",
          service: "s3",
        }),
        endpoint,
        bucket: set(env.S3_BUCKET)!,
        publicUrl: set(env.S3_PUBLIC_URL)!.replace(/\/$/, ""),
      }
    : null;

// Silence is the wrong default here: uploads landing on a container's local disk
// look fine until the container goes away.
if (!s3) {
  console.warn(
    "[storage] S3 is not fully configured; uploads go to public/uploads and will not survive a redeploy.",
  );
}

// Dev fallback: files go to apps/web/public/uploads and are served by Next.
const LOCAL_PREFIX = "/uploads";

function publicBaseUrl(): string {
  if (s3) return s3.publicUrl;
  return `${(env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "")}${LOCAL_PREFIX}`;
}

export async function putObject(key: string, body: Uint8Array<ArrayBuffer>, contentType: string): Promise<string> {
  if (s3) {
    const res = await s3.client.fetch(`${s3.endpoint}/${s3.bucket}/${key}`, {
      method: "PUT",
      body,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        /**
         * Sent explicitly, and this is load-bearing.
         *
         * aws4fetch wraps every request in `new Request(...)`, and a Request body
         * is always normalised to a stream — so the length is lost and the
         * runtime falls back to `Transfer-Encoding: chunked`. S3 rejects that on
         * PUT with `501 NotImplemented: A header you provided implies
         * functionality that is not implemented`.
         *
         * Declaring the length keeps it a single sized request. aws4fetch lists
         * `content-length` as unsignable, so adding it can't disturb the
         * signature.
         *
         * Wrapping the body in a Blob does *not* fix this — verified inside the
         * Next runtime, where it still came back 501, because the Request wrapper
         * discards the Blob's size just the same.
         */
        "Content-Length": String(body.byteLength),
      },
    });
    if (!res.ok) throw new Error(`Upload failed (${res.status}): ${await res.text()}`);
  } else {
    if (env.NODE_ENV === "production") throw new Error("Object storage (S3_*) is not configured");
    const file = path.join(process.cwd(), "public", LOCAL_PREFIX, key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
  }
  return `${publicBaseUrl()}/${key}`;
}

export type StoredObject = { key: string; bytes: number; modified: Date | null };

/**
 * Lists what is actually in storage.
 *
 * The bucket is the only place that knows about an object nobody references any
 * more — the database, by definition, has forgotten it. Paginates, because
 * ListObjectsV2 caps at 1000 keys and a truncated list would report real files as
 * absent, which is precisely the wrong direction for a tool that offers deletion.
 */
export async function listObjects(prefix = "", limit = 5000): Promise<StoredObject[]> {
  const found: StoredObject[] = [];

  if (s3) {
    let token: string | undefined;
    do {
      const url = new URL(`${s3.endpoint}/${s3.bucket}`);
      url.searchParams.set("list-type", "2");
      if (prefix) url.searchParams.set("prefix", prefix);
      url.searchParams.set("max-keys", String(Math.min(1000, limit - found.length)));
      if (token) url.searchParams.set("continuation-token", token);

      const res = await s3.client.fetch(url.toString());
      if (!res.ok) throw new Error(`List failed (${res.status}): ${await res.text()}`);
      const xml = await res.text();

      for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
        const body = m[1]!;
        const key = /<Key>([^<]+)<\/Key>/.exec(body)?.[1];
        if (!key) continue;
        found.push({
          key,
          bytes: Number(/<Size>(\d+)<\/Size>/.exec(body)?.[1] ?? 0),
          modified: /<LastModified>([^<]+)<\/LastModified>/.exec(body)?.[1]
            ? new Date(/<LastModified>([^<]+)<\/LastModified>/.exec(body)![1]!)
            : null,
        });
      }

      token = /<IsTruncated>true<\/IsTruncated>/.test(xml)
        ? /<NextContinuationToken>([^<]+)<\/NextContinuationToken>/.exec(xml)?.[1]
        : undefined;
    } while (token && found.length < limit);
    return found;
  }

  // Local fallback: walk public/uploads the same way, so the tool behaves
  // identically in development.
  const root = path.join(process.cwd(), "public", LOCAL_PREFIX);
  async function walk(dir: string, rel: string) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return; // No uploads directory yet is the same as an empty bucket.
    }
    for (const e of entries) {
      if (found.length >= limit) return;
      const abs = path.join(dir, e.name);
      const key = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) await walk(abs, key);
      else {
        const st = await stat(abs);
        found.push({ key, bytes: st.size, modified: st.mtime });
      }
    }
  }
  await walk(prefix ? path.join(root, prefix) : root, prefix);
  return found;
}

/** Removes one object. Returns false when it was already gone. */
export async function deleteObject(key: string): Promise<boolean> {
  if (s3) {
    const res = await s3.client.fetch(`${s3.endpoint}/${s3.bucket}/${key}`, { method: "DELETE" });
    // S3 answers 204 whether or not the key existed, so "already gone" and
    // "deleted" are indistinguishable — both are the outcome the caller wanted.
    return res.ok || res.status === 404;
  }
  try {
    await rm(path.join(process.cwd(), "public", LOCAL_PREFIX, key));
    return true;
  } catch {
    return false;
  }
}

/** Turns a public URL back into its storage key, or null if it isn't ours. */
export function keyFromUrl(url: string): string | null {
  const base = `${publicBaseUrl()}/`;
  return url.startsWith(base) ? url.slice(base.length) : null;
}

// True if the URL points at our own storage (so clients can't set arbitrary
// external image URLs on their profile).
export function isOwnUploadUrl(url: string): boolean {
  return url.startsWith(`${publicBaseUrl()}/`);
}

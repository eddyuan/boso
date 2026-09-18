import { mkdir, writeFile } from "node:fs/promises";
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
const endpoint =
  env.S3_ENDPOINT?.replace(/\/$/, "") ??
  (env.S3_REGION ? `https://s3.${env.S3_REGION}.amazonaws.com` : undefined);

const s3 =
  endpoint && env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY && env.S3_PUBLIC_URL
    ? {
        client: new AwsClient({
          accessKeyId: env.S3_ACCESS_KEY_ID,
          secretAccessKey: env.S3_SECRET_ACCESS_KEY,
          region: env.S3_REGION ?? "auto",
          service: "s3",
        }),
        endpoint,
        bucket: env.S3_BUCKET,
        publicUrl: env.S3_PUBLIC_URL.replace(/\/$/, ""),
      }
    : null;

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
      headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable" },
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

// True if the URL points at our own storage (so clients can't set arbitrary
// external image URLs on their profile).
export function isOwnUploadUrl(url: string): boolean {
  return url.startsWith(`${publicBaseUrl()}/`);
}

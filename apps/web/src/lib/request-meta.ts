// Client metadata extracted from request headers. On Vercel, x-forwarded-for
// is set by the edge and its first entry is the real client IP.
export function getClientIp(headers: Headers | undefined | null): string | null {
  if (!headers) return null;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("x-real-ip");
}

export function getDeviceName(headers: Headers | undefined | null): string | null {
  const name = headers?.get("x-device-name")?.trim();
  return name ? name.slice(0, 100) : null;
}

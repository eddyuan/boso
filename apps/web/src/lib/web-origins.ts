// Browser origins of other web frontends allowed to call this API with
// cookies — e.g. the Expo web build. Used for both CORS (src/proxy.ts) and
// Better Auth's trustedOrigins (CSRF/redirect checks), so they can't drift.
//
// WEB_APP_ORIGINS: comma-separated, e.g. "https://app.tielo.app"
export const webAppOrigins: string[] = [
  ...(process.env.WEB_APP_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean),
  // Expo web dev server (default port, plus a couple of fallbacks it picks
  // when 8081 is busy).
  ...(process.env.NODE_ENV === "development"
    ? ["http://localhost:8081", "http://localhost:8082", "http://localhost:19006"]
    : []),
];

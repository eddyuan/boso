import { NextResponse, type NextRequest } from "next/server";
import { webAppOrigins } from "@/lib/web-origins";

// CORS for the API. Only browsers enforce CORS — native mobile requests are
// unaffected — so this is for web frontends on another origin (Expo web).
export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin");
  const allowed = !!origin && webAppOrigins.includes(origin);

  const corsHeaders: Record<string, string> = allowed
    ? {
        "Access-Control-Allow-Origin": origin,
        // Session cookies are sent cross-origin (credentials: "include").
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers":
          request.headers.get("access-control-request-headers") ?? "Content-Type, x-device-name",
        "Access-Control-Max-Age": "600",
        Vary: "Origin",
      }
    : {};

  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: corsHeaders });
  }

  const response = NextResponse.next();
  for (const [key, value] of Object.entries(corsHeaders)) {
    response.headers.set(key, value);
  }
  return response;
}

export const config = {
  matcher: "/api/:path*",
};

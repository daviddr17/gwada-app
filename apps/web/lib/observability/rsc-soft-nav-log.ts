import type { NextRequest } from "next/server";

/** Kong/nginx/Go — ab ~8 KB Cookie-Header werden RSC-Requests oft abgewiesen. */
const COOKIE_HEADER_WARN_BYTES = 6144;

export function isAppRscRequest(request: NextRequest): boolean {
  return (
    request.headers.get("RSC") === "1" ||
    request.headers.get("Next-Router-Prefetch") === "1"
  );
}

export function requestCookieHeaderBytes(request: NextRequest): number {
  const raw = request.headers.get("cookie");
  if (!raw) return 0;
  return new TextEncoder().encode(raw).length;
}

/** Diagnose für Live-Soft-Nav: RSC-Flights unter /dashboard (Request-Seite). */
export function logDashboardRscRequest(
  request: NextRequest,
  pathname: string,
): void {
  if (!pathname.startsWith("/dashboard") || !isAppRscRequest(request)) return;

  const cookieBytes = requestCookieHeaderBytes(request);
  const payload = {
    pathname,
    cookieBytes,
    prefetch: request.headers.get("Next-Router-Prefetch") === "1",
    method: request.method,
  };

  if (cookieBytes >= COOKIE_HEADER_WARN_BYTES) {
    console.warn("[rsc:dashboard:cookie-large]", payload);
    return;
  }

  if (process.env.NODE_ENV === "development") {
    console.debug("[rsc:dashboard]", payload);
  }
}

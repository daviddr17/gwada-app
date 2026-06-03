import "server-only";

import {
  authEntryCookieClearHeaders,
  clearCookieSetCookieHeader,
  LEGACY_OAUTH_PENDING_COOKIE_NAMES,
} from "@/lib/cookies/bloated-request-cookies";

/** Kurzes Pending-ID-Cookie (~40 Bytes) — Payload liegt in oauth_integration_pending. */
export const OAUTH_PENDING_ID_COOKIE = "gwada_oauth_pending_id";

const PENDING_TTL_SEC = 15 * 60;

export { LEGACY_OAUTH_PENDING_COOKIE_NAMES as LEGACY_OAUTH_PENDING_COOKIES };

export function oauthPendingIdCookieHeader(pendingId: string): string {
  const parts = [
    `${OAUTH_PENDING_ID_COOKIE}=${encodeURIComponent(pendingId)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${PENDING_TTL_SEC}`,
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export function clearOAuthPendingIdCookieHeader(): string {
  return clearCookieSetCookieHeader(OAUTH_PENDING_ID_COOKIE);
}

export function clearLegacyOAuthPendingCookieHeaders(): string[] {
  return LEGACY_OAUTH_PENDING_COOKIE_NAMES.map((name) =>
    clearCookieSetCookieHeader(name),
  );
}

export function oauthPendingClearAllCookieHeaders(): string[] {
  return authEntryCookieClearHeaders();
}

export function readOAuthPendingIdFromRequest(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(
    new RegExp(`(?:^|; )${OAUTH_PENDING_ID_COOKIE}=([^;]*)`),
  );
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]).trim() || null;
  } catch {
    return match[1].trim() || null;
  }
}

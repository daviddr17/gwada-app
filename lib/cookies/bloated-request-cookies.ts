import "server-only";

import { gwadaSupabaseCookieOptions } from "@/lib/supabase/ssr-cookie-options";

/** Volles OAuth-JSON im Cookie — Hauptursache für „header/cookie too large“. */
export const LEGACY_OAUTH_PENDING_COOKIE_NAMES = [
  "gwada_meta_oauth_pending",
  "gwada_google_oauth_pending",
] as const;

export const OAUTH_PENDING_ID_COOKIE = "gwada_oauth_pending_id";

export const GOOGLE_AUTH_NONCE_COOKIE = "gwada_google_oauth_nonce";

/** Beim Auth-Einstieg (Login, Callback) per Set-Cookie löschen. */
export const AUTH_ENTRY_COOKIES_TO_CLEAR = [
  ...LEGACY_OAUTH_PENDING_COOKIE_NAMES,
  OAUTH_PENDING_ID_COOKIE,
  GOOGLE_AUTH_NONCE_COOKIE,
] as const;

const SUPABASE_SESSION_COOKIE = gwadaSupabaseCookieOptions.name;
const SUPABASE_SESSION_CHUNK_RE = new RegExp(
  `^${SUPABASE_SESSION_COOKIE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\.\\d+)?$`,
);

function isSupabaseSessionCookie(name: string): boolean {
  return SUPABASE_SESSION_CHUNK_RE.test(name);
}

/** Cookies, die Kong/GoTrue nicht braucht — vom Request vor /sb-Proxy entfernen. */
export function shouldStripCookieFromSupabaseProxy(name: string): boolean {
  if (isSupabaseSessionCookie(name)) return false;
  if (
    (AUTH_ENTRY_COOKIES_TO_CLEAR as readonly string[]).includes(name) ||
    (LEGACY_OAUTH_PENDING_COOKIE_NAMES as readonly string[]).includes(name)
  ) {
    return true;
  }
  if (name.startsWith("gwada-") || name.startsWith("gwada_")) return true;
  return false;
}

export function clearCookieSetCookieHeader(name: string): string {
  const parts = [
    `${name}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export function authEntryCookieClearHeaders(): string[] {
  return AUTH_ENTRY_COOKIES_TO_CLEAR.map((name) =>
    clearCookieSetCookieHeader(name),
  );
}

/** Cookie-Header für Upstream kürzen (Login/Token auch bei übergroßen Browser-Cookies). */
export function stripBloatedCookiesFromCookieHeader(
  cookieHeader: string | null,
): string | undefined {
  if (!cookieHeader?.trim()) return undefined;

  const kept: string[] = [];
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    const name = (eq >= 0 ? trimmed.slice(0, eq) : trimmed).trim();
    if (!name || shouldStripCookieFromSupabaseProxy(name)) continue;
    kept.push(trimmed);
  }

  return kept.length > 0 ? kept.join("; ") : undefined;
}

export function appendAuthEntryCookieCleanup(headers: Headers): void {
  for (const c of authEntryCookieClearHeaders()) {
    headers.append("Set-Cookie", c);
  }
}

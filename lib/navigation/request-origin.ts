import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { getPublicSiteUrl } from "@/lib/public-env";

function primaryHost(raw: string | null): string | null {
  const host = raw?.split(",")[0]?.trim();
  return host || null;
}

/** Server Components / Route Handlers — hinter Traefik/Coolify-Proxy. */
export async function resolveRequestOrigin(): Promise<string | null> {
  const h = await headers();
  const host = primaryHost(h.get("x-forwarded-host") ?? h.get("host"));
  if (!host) return null;
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "https";
  return `${proto}://${host}`;
}

/** Route Handler mit `NextRequest` (sync, ohne `headers()`). */
export function resolveRequestOriginFromRequest(
  request: NextRequest | Request,
): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = primaryHost(forwardedHost ?? request.headers.get("host"));
  if (host) {
    const proto =
      request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
      "https";
    return `${proto}://${host}`;
  }
  return new URL(request.url).origin;
}

function isLoopbackOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    return u.hostname === "localhost" || u.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

/**
 * Öffentliche App-URL für Links (Magic Link, Display-Kopplung, …).
 * Traefik/Coolify-Header → NEXT_PUBLIC_SITE_URL → localhost (nur Dev).
 */
export function resolvePublicAppOrigin(request: Request): string {
  const fromHeaders = resolveRequestOriginFromRequest(request).replace(/\/+$/, "");
  const fromEnv = getPublicSiteUrl()?.replace(/\/+$/, "");
  if (fromHeaders && !isLoopbackOrigin(fromHeaders)) return fromHeaders;
  if (fromEnv) return fromEnv;
  return "http://localhost:3000";
}

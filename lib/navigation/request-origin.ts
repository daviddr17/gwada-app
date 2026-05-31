import { headers } from "next/headers";
import type { NextRequest } from "next/server";

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

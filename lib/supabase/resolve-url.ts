/**
 * Browser → Supabase: bei HTTPS-App und HTTP-API blockiert Mixed Content Client-Fetches.
 * Mit Proxy: App ruft `/sb/*` auf, Next rewritet zu SUPABASE_UPSTREAM_URL.
 *
 * Coolify: NEXT_PUBLIC_SUPABASE_PROXY=true, SUPABASE_UPSTREAM_URL=Kong im Docker-Netz,
 * NEXT_PUBLIC_SITE_URL=https://deine-app-domain (für SSR/Auth-Callback).
 */

import {
  getPublicSiteUrl,
  getPublicSupabaseUrl,
  getSupabaseAnonKey,
  isPublicSupabaseProxyEnabled,
} from "@/lib/public-env";
import { resolveSupabaseUpstreamUrl } from "@/lib/supabase/supabase-upstream-url";

function trimSlash(s: string): string {
  return s.replace(/\/+$/, "");
}

export function isSupabaseProxyEnabled(): boolean {
  return isPublicSupabaseProxyEnabled();
}

/** Upstream (Kong) — Server-Proxy `/sb` (Route Handler), nicht im Browser. */
export function getSupabaseUpstreamUrl(): string | null {
  if (process.env.SUPABASE_UPSTREAM_URL?.trim() || process.env.NODE_ENV === "production") {
    return resolveSupabaseUpstreamUrl();
  }
  const direct = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (direct && !direct.includes("/sb")) return trimSlash(direct);
  return null;
}

/**
 * URL für createBrowserClient / createServerClient (Cookie-Domain muss konsistent sein).
 * @param origin — z. B. aus `new URL(request.url).origin` oder `window.location.origin`
 */
export function resolveSupabaseUrl(origin?: string | null): string {
  if (!getSupabaseAnonKey()) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  if (isSupabaseProxyEnabled()) {
    if (origin) return `${trimSlash(origin)}/sb`;
    if (typeof window !== "undefined") {
      return `${window.location.origin}/sb`;
    }
    const site = getPublicSiteUrl();
    if (site) return `${trimSlash(site)}/sb`;
    const fallback = getPublicSupabaseUrl();
    if (fallback) return trimSlash(fallback);
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_PROXY=true: set NEXT_PUBLIC_SITE_URL or NEXT_PUBLIC_SUPABASE_URL (https://…/sb)",
    );
  }

  const direct = getPublicSupabaseUrl();
  if (direct) return trimSlash(direct);
  if (origin) return `${trimSlash(origin)}/sb`;
  if (process.env.NODE_ENV === "production") return resolveSupabaseUpstreamUrl();
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
}

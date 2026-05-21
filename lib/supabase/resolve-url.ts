/**
 * Browser → Supabase: bei HTTPS-App und HTTP-API blockiert Mixed Content Client-Fetches.
 * Mit Proxy: App ruft `/sb/*` auf, Next rewritet zu SUPABASE_UPSTREAM_URL.
 *
 * Coolify: NEXT_PUBLIC_SUPABASE_PROXY=true, SUPABASE_UPSTREAM_URL=http://…:8001,
 * NEXT_PUBLIC_SITE_URL=https://deine-app-domain (für SSR/Auth-Callback).
 */

function trimSlash(s: string): string {
  return s.replace(/\/+$/, "");
}

const VPS_APP_ORIGIN = "http://95.111.229.250:3000";
const VPS_KONG_URL = "http://95.111.229.250:8001";

export function isSupabaseProxyEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_SUPABASE_PROXY?.trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  const pub = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (pub?.includes("/sb")) return true;
  /* Coolify-Runtime: oft nur Anon-Key — Live-Build nutzt /sb im Client-Bundle */
  if (typeof window === "undefined" && process.env.NODE_ENV === "production") {
    return Boolean(process.env.SUPABASE_UPSTREAM_URL?.trim());
  }
  return false;
}

/** Upstream (Kong) — Server-Proxy `/sb` (Route Handler), nicht im Browser. */
export function getSupabaseUpstreamUrl(): string | null {
  const u = process.env.SUPABASE_UPSTREAM_URL?.trim();
  if (u) return trimSlash(u);
  const direct = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (direct && !direct.includes("/sb")) return trimSlash(direct);
  if (process.env.NODE_ENV === "production") return VPS_KONG_URL;
  return null;
}

/**
 * URL für createBrowserClient / createServerClient (Cookie-Domain muss konsistent sein).
 * @param origin — z. B. aus `new URL(request.url).origin` oder `window.location.origin`
 */
export function resolveSupabaseUrl(origin?: string | null): string {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  if (isSupabaseProxyEnabled()) {
    if (origin) return `${trimSlash(origin)}/sb`;
    if (typeof window !== "undefined") {
      return `${window.location.origin}/sb`;
    }
    const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (site) return `${trimSlash(site)}/sb`;
    const fallback = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    if (fallback) return trimSlash(fallback);
    if (process.env.NODE_ENV === "production") {
      return `${VPS_APP_ORIGIN}/sb`;
    }
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_PROXY=true: set NEXT_PUBLIC_SITE_URL or NEXT_PUBLIC_SUPABASE_URL (https://…/sb)",
    );
  }

  const direct = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (direct) return trimSlash(direct);
  if (origin) return `${trimSlash(origin)}/sb`;
  if (process.env.NODE_ENV === "production") return VPS_KONG_URL;
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
}

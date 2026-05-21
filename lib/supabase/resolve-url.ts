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

export function isSupabaseProxyEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_SUPABASE_PROXY?.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

/** Upstream (Kong) — nur Server/Rewrites, nicht im Browser. */
export function getSupabaseUpstreamUrl(): string | null {
  const u = process.env.SUPABASE_UPSTREAM_URL?.trim();
  return u ? trimSlash(u) : null;
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
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_PROXY=true: set NEXT_PUBLIC_SITE_URL or NEXT_PUBLIC_SUPABASE_URL (https://…/sb)",
    );
  }

  const direct = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!direct) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }
  return trimSlash(direct);
}

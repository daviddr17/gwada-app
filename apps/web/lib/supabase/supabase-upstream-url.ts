/**
 * Kong/Supabase-API für den Server-Proxy `/sb`.
 * In Coolify-Docker ist `127.0.0.1:8001` die App selbst — nicht Kong.
 */

function trimBase(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Produktion: Kong-Container im Netzwerk `coolify` (Coolify Supabase-Stack). */
const DEFAULT_COOLIFY_KONG_URL =
  "http://supabase-kong-oogd5syyxiqb1k4g0wy1u9n8:8000";

function isLocalhostKong(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      (u.hostname === "127.0.0.1" || u.hostname === "localhost") &&
      (u.port === "8001" || u.port === "54321" || u.port === "")
    );
  } catch {
    return false;
  }
}

export function resolveSupabaseUpstreamUrl(): string {
  const raw = process.env.SUPABASE_UPSTREAM_URL?.trim();
  const fallback =
    process.env.SUPABASE_KONG_INTERNAL_URL?.trim() ||
    process.env.SUPABASE_UPSTREAM_FALLBACK?.trim() ||
    DEFAULT_COOLIFY_KONG_URL;

  if (raw) {
    const base = trimBase(raw);
    if (process.env.NODE_ENV === "production" && isLocalhostKong(base)) {
      return trimBase(fallback);
    }
    return base;
  }

  if (process.env.NODE_ENV === "production") {
    return trimBase(fallback);
  }

  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (publicUrl && !publicUrl.includes("/sb")) {
    return trimBase(publicUrl);
  }

  return "http://127.0.0.1:54321";
}

import {
  getPublicSiteUrl,
  getPublicSupabaseUrl,
  isPublicSupabaseProxyEnabled,
} from "@/lib/public-env";
import { resolveSupabaseUpstreamUrl } from "@/lib/supabase/supabase-upstream-url";

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function hostnameFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isPrivateIpv4(hostname: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (!match) return false;
  const octets = match.slice(1, 5).map((part) => Number.parseInt(part, 10));
  if (octets.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return false;
  const [a, b] = octets;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 127) return true;
  return false;
}

function isInternalAuthHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return (
    lower.includes("kong") ||
    lower === "localhost" ||
    lower === "127.0.0.1" ||
    lower.endsWith(".internal") ||
    lower.startsWith("supabase-") ||
    isPrivateIpv4(lower)
  );
}

function isPublicHttpsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    if (isInternalAuthHost(host)) return false;
    return !/^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  } catch {
    return false;
  }
}

function publicAuthApiBaseFromSiteOrigin(origin: string): string {
  const trimmed = trimSlash(origin);
  if (
    isPublicSupabaseProxyEnabled() ||
    process.env.SUPABASE_UPSTREAM_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("/sb")
  ) {
    return `${trimmed}/sb`;
  }
  return trimmed;
}

/** Öffentliche Supabase-API-Basis für Auth-Links in E-Mails (`https://gwada.app/sb`). */
export function resolvePublicAuthApiBase(
  siteUrlOverride?: string | null,
): string | null {
  const override = siteUrlOverride?.trim();
  if (override) {
    // Explizite App-Origin aus E-Mail-Callern → immer über /sb-Proxy.
    return `${trimSlash(override)}/sb`;
  }

  const site =
    getPublicSiteUrl()?.trim() || process.env.GWADA_PUBLIC_SITE_URL?.trim();
  if (site) {
    return publicAuthApiBaseFromSiteOrigin(site);
  }

  const publicSupabase = getPublicSupabaseUrl();
  if (publicSupabase && isPublicHttpsUrl(publicSupabase)) {
    return trimSlash(publicSupabase);
  }

  return null;
}

/**
 * GoTrue `generateLink` liefert bei Admin-Clients oft interne Kong-Hosts
 * (`http://supabase-kong:8000/auth/v1/verify?...`). Für E-Mails auf öffentliche
 * App-URL umschreiben (`https://gwada.app/sb/auth/v1/verify?...`).
 */
export function rewriteAdminAuthActionLink(
  actionLink: string,
  options?: { siteUrl?: string | null; redirectTo?: string | null },
): string {
  let parsed: URL;
  try {
    parsed = new URL(actionLink);
  } catch {
    return actionLink;
  }

  if (options?.redirectTo?.trim()) {
    parsed.searchParams.set("redirect_to", options.redirectTo.trim());
  }

  const upstreamHost = hostnameFromUrl(resolveSupabaseUpstreamUrl());
  const host = parsed.hostname.toLowerCase();
  const isInternal =
    isInternalAuthHost(host) ||
    (upstreamHost !== null && host === upstreamHost);

  if (!isInternal) {
    if (options?.redirectTo?.trim()) {
      return parsed.toString();
    }
    return actionLink;
  }

  const publicBase = resolvePublicAuthApiBase(options?.siteUrl);
  if (!publicBase) return parsed.toString();

  return `${trimSlash(publicBase)}${parsed.pathname}${parsed.search}${parsed.hash}`;
}

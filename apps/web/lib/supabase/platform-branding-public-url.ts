import "server-only";

import { resolveSupabaseUpstreamUrl } from "@/lib/supabase/supabase-upstream-url";
import {
  getPublicSupabaseUrl,
  isPublicSupabaseProxyEnabled,
} from "@/lib/public-env";

const BUCKET = "platform-branding";

const ALLOWED_STORAGE_PREFIXES = ["logo-", "logo_dark-", "favicon-"] as const;

export function isAllowedPlatformBrandingStoragePath(
  storagePath: string | null | undefined,
): boolean {
  const path = storagePath?.trim();
  if (!path || path.includes("..") || path.includes("/")) return false;
  return ALLOWED_STORAGE_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function objectPublicPath(storagePath: string): string {
  const encoded = storagePath
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `/storage/v1/object/public/${BUCKET}/${encoded}`;
}

/** Öffentliche Branding-Asset-URL für Browser, Metadata und API-Responses. */
export function platformBrandingPublicObjectPath(
  storagePath: string | null | undefined,
): string | null {
  const path = storagePath?.trim();
  if (!path) return null;

  const objectPath = objectPublicPath(path);

  if (isPublicSupabaseProxyEnabled()) {
    return `/sb${objectPath}`;
  }

  const directBase = getPublicSupabaseUrl();
  if (directBase) {
    return `${directBase.replace(/\/+$/, "")}${objectPath}`;
  }

  return `/sb${objectPath}`;
}

export function platformBrandingPublicObjectUrl(
  storagePath: string | null | undefined,
): string | null {
  return platformBrandingPublicObjectPath(storagePath);
}

/** Server-Fetch gegen Storage (Proxy oder direkte Supabase-URL). */
export function resolvePlatformBrandingFetchUrl(
  storagePath: string | null | undefined,
): string | null {
  const publicPath = platformBrandingPublicObjectPath(storagePath);
  if (!publicPath) return null;
  if (publicPath.startsWith("http://") || publicPath.startsWith("https://")) {
    return publicPath;
  }
  if (publicPath.startsWith("/sb")) {
    return `${resolveSupabaseUpstreamUrl()}${publicPath.slice("/sb".length)}`;
  }
  return publicPath;
}

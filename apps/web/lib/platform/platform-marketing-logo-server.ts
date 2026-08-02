import "server-only";

import {
  getCachedPlatformAsset,
  setCachedPlatformAsset,
} from "@/lib/platform/platform-asset-memory-cache";
import { optimizeLogoBufferForMarketing } from "@/lib/platform/platform-logo-optimize";
import {
  isAllowedPlatformLogoStoragePath,
  platformLogoStoragePathForTheme,
} from "@/lib/platform/platform-marketing-logo-url";
import type { PlatformLogoTheme } from "@/lib/platform/resolve-platform-logo";
import { fetchPlatformAppBranding } from "@/lib/supabase/platform-app-settings-db";
import { resolvePlatformBrandingFetchUrl } from "@/lib/supabase/platform-branding-public-url";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PlatformMarketingLogoAsset = {
  body: Buffer;
  contentType: "image/webp";
  etag: string;
};

const LOGO_CACHE_TTL_MS = 60 * 60 * 1000;

function logoUpstreamUrl(storagePath: string): string | null {
  return resolvePlatformBrandingFetchUrl(storagePath);
}

export async function loadPlatformMarketingLogoAsset(params: {
  storagePath: string;
  theme: PlatformLogoTheme;
}): Promise<PlatformMarketingLogoAsset | null> {
  const path = params.storagePath.trim();
  if (!isAllowedPlatformLogoStoragePath(path)) return null;

  const cacheKey = `marketing-logo:${path}:${params.theme}`;
  const cached = getCachedPlatformAsset<PlatformMarketingLogoAsset>(cacheKey);
  if (cached) return cached;

  const fetchUrl = logoUpstreamUrl(path);
  if (!fetchUrl) return null;

  const res = await fetch(fetchUrl, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;

  const raw = Buffer.from(await res.arrayBuffer());
  const body = await optimizeLogoBufferForMarketing(raw);

  const asset: PlatformMarketingLogoAsset = {
    body,
    contentType: "image/webp",
    etag: `"marketing-logo:${path}:${params.theme}"`,
  };
  setCachedPlatformAsset(cacheKey, asset, LOGO_CACHE_TTL_MS);
  return asset;
}

export async function loadPlatformMarketingLogoAssetFromBranding(
  theme: PlatformLogoTheme,
): Promise<PlatformMarketingLogoAsset | null> {
  const sb = await createSupabaseServerClient();
  const branding = await fetchPlatformAppBranding(sb);
  const storagePath = platformLogoStoragePathForTheme(branding, theme);
  if (!storagePath) return null;
  return loadPlatformMarketingLogoAsset({ storagePath, theme });
}

export function platformMarketingLogoResponse(
  asset: PlatformMarketingLogoAsset,
  request: Request,
): Response {
  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch === asset.etag) {
    return new Response(null, { status: 304 });
  }

  return new Response(new Uint8Array(asset.body), {
    headers: {
      "Content-Type": asset.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: asset.etag,
      Vary: "Accept-Encoding",
    },
  });
}

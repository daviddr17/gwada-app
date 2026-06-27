import "server-only";

import { faviconMimeTypeFromPath } from "@/lib/platform/branding-asset-url";
import {
  isAllowedPlatformBrandingStoragePath,
  resolvePlatformBrandingFetchUrl,
} from "@/lib/supabase/platform-branding-public-url";

export type PlatformBrandingAsset = {
  body: ArrayBuffer;
  contentType: string;
  etag: string;
};

export async function loadPlatformBrandingAsset(
  storagePath: string,
): Promise<PlatformBrandingAsset | null> {
  const path = storagePath.trim();
  if (!isAllowedPlatformBrandingStoragePath(path)) return null;

  const fetchUrl = resolvePlatformBrandingFetchUrl(path);
  if (!fetchUrl) return null;

  try {
    const res = await fetch(fetchUrl, { cache: "no-store" });
    if (!res.ok) return null;

    return {
      body: await res.arrayBuffer(),
      contentType:
        faviconMimeTypeFromPath(path) ??
        res.headers.get("content-type") ??
        "application/octet-stream",
      etag: `"branding:${path}"`,
    };
  } catch {
    return null;
  }
}

export function platformBrandingAssetResponse(
  asset: PlatformBrandingAsset,
  request: Request,
): Response {
  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch === asset.etag) {
    return new Response(null, { status: 304 });
  }

  return new Response(asset.body, {
    headers: {
      "Content-Type": asset.contentType,
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      ETag: asset.etag,
    },
  });
}

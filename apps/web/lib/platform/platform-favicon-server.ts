import "server-only";

import { faviconMimeTypeFromPath } from "@/lib/platform/branding-asset-url";
import { fetchPlatformAppBranding } from "@/lib/supabase/platform-app-settings-db";
import { resolvePlatformBrandingFetchUrl } from "@/lib/supabase/platform-branding-public-url";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PlatformFaviconAsset = {
  body: ArrayBuffer;
  contentType: string;
  etag: string;
};

function faviconUpstreamUrl(storagePath: string): string | null {
  return resolvePlatformBrandingFetchUrl(storagePath);
}

export async function loadPlatformFaviconAsset(): Promise<PlatformFaviconAsset | null> {
  try {
    const sb = await createSupabaseServerClient();
    const branding = await fetchPlatformAppBranding(sb);
    const path = branding.faviconPath?.trim();
    if (!path) return null;

    const fetchUrl = faviconUpstreamUrl(path);
    if (!fetchUrl) return null;

    const res = await fetch(fetchUrl, { cache: "no-store" });
    if (!res.ok) return null;

    return {
      body: await res.arrayBuffer(),
      contentType:
        faviconMimeTypeFromPath(path) ??
        res.headers.get("content-type") ??
        "image/png",
      etag: `"${path}"`,
    };
  } catch {
    return null;
  }
}

export function platformFaviconResponse(
  asset: PlatformFaviconAsset,
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

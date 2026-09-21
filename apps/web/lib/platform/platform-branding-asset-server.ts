import "server-only";

import { faviconMimeTypeFromPath } from "@/lib/platform/branding-asset-url";
import {
  isAllowedPlatformBrandingStoragePath,
  resolvePlatformBrandingFetchUrl,
} from "@/lib/supabase/platform-branding-public-url";
import { sanitizeSvgBytes } from "@/lib/uploads/sanitize-svg";
import {
  NOSNIFF_HEADER,
  SVG_DOCUMENT_GUARD_HEADERS,
} from "@/lib/uploads/upload-response-headers";

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

    const contentType =
      faviconMimeTypeFromPath(path) ??
      res.headers.get("content-type") ??
      "application/octet-stream";
    let body = await res.arrayBuffer();
    const isSvg =
      contentType.includes("svg") || path.toLowerCase().endsWith(".svg");
    if (isSvg) {
      const clean = sanitizeSvgBytes(new Uint8Array(body));
      if (!clean) return null;
      const copy = new Uint8Array(clean.byteLength);
      copy.set(clean);
      body = copy.buffer;
    }

    return {
      body,
      contentType,
      etag: path.toLowerCase().endsWith(".svg")
        ? `"branding-svg:${path}"`
        : `"branding:${path}"`,
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

  const svg = asset.contentType.includes("svg");
  return new Response(asset.body, {
    headers: {
      "Content-Type": asset.contentType,
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      ETag: asset.etag,
      ...(svg ? SVG_DOCUMENT_GUARD_HEADERS : NOSNIFF_HEADER),
    },
  });
}

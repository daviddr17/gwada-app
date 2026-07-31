import "server-only";

import sharp from "sharp";
import { faviconMimeTypeFromPath } from "@/lib/platform/branding-asset-url";
import {
  getCachedPlatformAsset,
  setCachedPlatformAsset,
} from "@/lib/platform/platform-asset-memory-cache";
import { fetchPlatformAppBranding } from "@/lib/supabase/platform-app-settings-db";
import { resolvePlatformBrandingFetchUrl } from "@/lib/supabase/platform-branding-public-url";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PlatformFaviconAsset = {
  body: ArrayBuffer;
  contentType: string;
  etag: string;
};

const FAVICON_CACHE_TTL_MS = 60 * 60 * 1000;
/** UI-Chips / Browser-Tab — keine 800KB-Quelle ausliefern. */
const FAVICON_EDGE_PX = 64;

function faviconUpstreamUrl(storagePath: string): string | null {
  return resolvePlatformBrandingFetchUrl(storagePath);
}

function bufferToArrayBuffer(buf: Buffer): ArrayBuffer {
  const copy = new Uint8Array(buf.byteLength);
  copy.set(buf);
  return copy.buffer;
}

async function optimizeFaviconBuffer(
  input: Buffer,
  path: string,
): Promise<{ body: Buffer; contentType: string }> {
  const mime = faviconMimeTypeFromPath(path) ?? "";
  if (mime === "image/svg+xml" || path.toLowerCase().endsWith(".svg")) {
    return { body: input, contentType: "image/svg+xml" };
  }
  try {
    const body = await sharp(input, { animated: false })
      .rotate()
      .resize(FAVICON_EDGE_PX, FAVICON_EDGE_PX, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .png({ compressionLevel: 9 })
      .toBuffer();
    return { body, contentType: "image/png" };
  } catch {
    return {
      body: input,
      contentType: mime || "image/png",
    };
  }
}

export async function loadPlatformFaviconAsset(): Promise<PlatformFaviconAsset | null> {
  try {
    const sb = await createSupabaseServerClient();
    const branding = await fetchPlatformAppBranding(sb);
    const path = branding.faviconPath?.trim();
    if (!path) return null;

    const cacheKey = `favicon:${path}`;
    const cached = getCachedPlatformAsset<PlatformFaviconAsset>(cacheKey);
    if (cached) return cached;

    const fetchUrl = faviconUpstreamUrl(path);
    if (!fetchUrl) return null;

    const res = await fetch(fetchUrl, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;

    const raw = Buffer.from(await res.arrayBuffer());
    const optimized = await optimizeFaviconBuffer(raw, path);
    const asset: PlatformFaviconAsset = {
      body: bufferToArrayBuffer(optimized.body),
      contentType: optimized.contentType,
      etag: `"favicon-opt:${path}:${FAVICON_EDGE_PX}"`,
    };
    setCachedPlatformAsset(cacheKey, asset, FAVICON_CACHE_TTL_MS);
    return asset;
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
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      ETag: asset.etag,
    },
  });
}

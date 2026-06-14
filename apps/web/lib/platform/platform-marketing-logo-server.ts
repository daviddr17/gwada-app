import "server-only";

import { optimizeLogoBufferForMarketing } from "@/lib/platform/platform-logo-optimize";
import {
  isAllowedPlatformLogoStoragePath,
  platformLogoStoragePathForTheme,
} from "@/lib/platform/platform-marketing-logo-url";
import type { PlatformLogoTheme } from "@/lib/platform/resolve-platform-logo";
import { fetchPlatformAppBranding } from "@/lib/supabase/platform-app-settings-db";
import { platformBrandingPublicObjectPath } from "@/lib/supabase/platform-branding-public-url";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveSupabaseUpstreamUrl } from "@/lib/supabase/supabase-upstream-url";

export type PlatformMarketingLogoAsset = {
  body: Buffer;
  contentType: "image/webp";
  etag: string;
};

function logoUpstreamUrl(storagePath: string): string | null {
  const rel = platformBrandingPublicObjectPath(storagePath);
  if (!rel) return null;
  return `${resolveSupabaseUpstreamUrl()}${rel.slice("/sb".length)}`;
}

export async function loadPlatformMarketingLogoAsset(params: {
  storagePath: string;
  theme: PlatformLogoTheme;
}): Promise<PlatformMarketingLogoAsset | null> {
  const path = params.storagePath.trim();
  if (!isAllowedPlatformLogoStoragePath(path)) return null;

  const fetchUrl = logoUpstreamUrl(path);
  if (!fetchUrl) return null;

  const res = await fetch(fetchUrl, { cache: "no-store" });
  if (!res.ok) return null;

  const raw = Buffer.from(await res.arrayBuffer());
  const body = await optimizeLogoBufferForMarketing(raw);

  return {
    body,
    contentType: "image/webp",
    etag: `"marketing-logo:${path}:${params.theme}"`,
  };
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

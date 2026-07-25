import "server-only";

import sharp from "sharp";
import { resolveMetaInboxAuth } from "@/lib/contact-messages/meta-inbox-auth-server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import type { SupabaseClient } from "@supabase/supabase-js";

export type MetaMediaPlatform = "facebook" | "instagram";

/** Erlaubte Thumb-Breiten für `?w=` (sharp resize → webp). */
export const META_MEDIA_PROXY_THUMB_WIDTHS = [
  80, 160, 240, 320, 480,
] as const;

export type MetaMediaProxyThumbWidth =
  (typeof META_MEDIA_PROXY_THUMB_WIDTHS)[number];

const META_MEDIA_PROXY_THUMB_WIDTH_SET = new Set<number>(
  META_MEDIA_PROXY_THUMB_WIDTHS,
);

const META_MEDIA_PROXY_THUMB_WEBP_QUALITY = 72;
const META_MEDIA_PROXY_THUMB_CACHE_SECONDS = 86400;
const META_MEDIA_PROXY_DEFAULT_CACHE_SECONDS = 300;

export type MetaMediaProxyRequest = {
  restaurantId: string;
  platform: MetaMediaPlatform;
  mediaUrl: string;
  maxWidth?: MetaMediaProxyThumbWidth;
};

export type MetaMediaProxyCacheControl = "private" | "public";

function isAllowedMetaMediaHost(hostname: string): boolean {
  return (
    hostname.endsWith("fbcdn.net") ||
    hostname.endsWith("facebook.com") ||
    hostname.endsWith("instagram.com")
  );
}

function parseThumbWidth(
  raw: string | null,
): MetaMediaProxyThumbWidth | undefined {
  if (!raw?.trim()) return undefined;
  const n = Number.parseInt(raw, 10);
  if (!META_MEDIA_PROXY_THUMB_WIDTH_SET.has(n)) return undefined;
  return n as MetaMediaProxyThumbWidth;
}

export function parseMetaMediaProxyRequest(
  searchParams: URLSearchParams,
):
  | { ok: true; params: MetaMediaProxyRequest }
  | { ok: false; status: number; message: string } {
  const restaurantId = searchParams.get("restaurantId")?.trim() ?? "";
  const platform = searchParams.get("platform");
  const mediaUrl = searchParams.get("url")?.trim() ?? "";
  const maxWidth = parseThumbWidth(searchParams.get("w"));

  if (!isUuidRestaurantId(restaurantId)) {
    return { ok: false, status: 400, message: "Bad request" };
  }

  if (!mediaUrl || (platform !== "facebook" && platform !== "instagram")) {
    return { ok: false, status: 400, message: "Bad request" };
  }

  // Ungültiges w ignorieren (volle Größe), nicht 400 — ältere Clients.
  let parsed: URL;
  try {
    parsed = new URL(mediaUrl);
  } catch {
    return { ok: false, status: 403, message: "Forbidden" };
  }

  if (!isAllowedMetaMediaHost(parsed.hostname)) {
    return { ok: false, status: 403, message: "Forbidden" };
  }

  return {
    ok: true,
    params: { restaurantId, platform, mediaUrl, maxWidth },
  };
}

function cacheHeader(
  cacheControl: MetaMediaProxyCacheControl,
  seconds: number,
): string {
  return cacheControl === "public"
    ? `public, max-age=${seconds}, s-maxage=${seconds}`
    : `private, max-age=${seconds}`;
}

export async function fetchMetaMediaProxyResponse(
  admin: SupabaseClient,
  params: MetaMediaProxyRequest,
  cacheControl: MetaMediaProxyCacheControl,
): Promise<Response> {
  const metaAuth = await resolveMetaInboxAuth(
    admin,
    params.restaurantId,
    params.platform,
  );
  if (!metaAuth) {
    return new Response("Not connected", { status: 502 });
  }

  const fetchUrl = new URL(params.mediaUrl);
  fetchUrl.searchParams.set("access_token", metaAuth.pageAccessToken);

  const res = await fetch(fetchUrl.toString(), { cache: "no-store" });
  if (!res.ok) {
    return new Response("Upstream error", { status: 502 });
  }

  const contentType =
    res.headers.get("content-type") ?? "application/octet-stream";
  const bytes = await res.arrayBuffer();

  if (
    params.maxWidth &&
    contentType.toLowerCase().startsWith("image/")
  ) {
    try {
      const resized = await sharp(Buffer.from(bytes), { failOn: "none" })
        .rotate()
        .resize({
          width: params.maxWidth,
          withoutEnlargement: true,
        })
        .webp({ quality: META_MEDIA_PROXY_THUMB_WEBP_QUALITY })
        .toBuffer();

      return new Response(resized, {
        headers: {
          "Content-Type": "image/webp",
          "Cache-Control": cacheHeader(
            cacheControl,
            META_MEDIA_PROXY_THUMB_CACHE_SECONDS,
          ),
        },
      });
    } catch {
      // Resize fehlgeschlagen — Original ausliefern.
    }
  }

  return new Response(bytes, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": cacheHeader(
        cacheControl,
        META_MEDIA_PROXY_DEFAULT_CACHE_SECONDS,
      ),
    },
  });
}

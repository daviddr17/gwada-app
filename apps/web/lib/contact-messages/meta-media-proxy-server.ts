import "server-only";

import { resolveMetaInboxAuth } from "@/lib/contact-messages/meta-inbox-auth-server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import type { SupabaseClient } from "@supabase/supabase-js";

export type MetaMediaPlatform = "facebook" | "instagram";

export type MetaMediaProxyRequest = {
  restaurantId: string;
  platform: MetaMediaPlatform;
  mediaUrl: string;
};

export type MetaMediaProxyCacheControl = "private" | "public";

function isAllowedMetaMediaHost(hostname: string): boolean {
  return (
    hostname.endsWith("fbcdn.net") ||
    hostname.endsWith("facebook.com") ||
    hostname.endsWith("instagram.com")
  );
}

export function parseMetaMediaProxyRequest(
  searchParams: URLSearchParams,
):
  | { ok: true; params: MetaMediaProxyRequest }
  | { ok: false; status: number; message: string } {
  const restaurantId = searchParams.get("restaurantId")?.trim() ?? "";
  const platform = searchParams.get("platform");
  const mediaUrl = searchParams.get("url")?.trim() ?? "";

  if (!isUuidRestaurantId(restaurantId)) {
    return { ok: false, status: 400, message: "Bad request" };
  }

  if (!mediaUrl || (platform !== "facebook" && platform !== "instagram")) {
    return { ok: false, status: 400, message: "Bad request" };
  }

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
    params: { restaurantId, platform, mediaUrl },
  };
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

  const cacheHeader =
    cacheControl === "public"
      ? "public, max-age=300, s-maxage=300"
      : "private, max-age=300";

  return new Response(bytes, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": cacheHeader,
    },
  });
}

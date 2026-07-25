import {
  publicProfileImageResponse,
  resolvePublicProfileImageAsset,
} from "@/lib/restaurant/public-profile-image-server";
import type { RestaurantProfileImageKind } from "@/lib/restaurant/restaurant-profile-image";

export const runtime = "nodejs";

function parseKind(raw: string | null): RestaurantProfileImageKind | null {
  if (raw === "avatar" || raw === "cover") return raw;
  return null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  const kind = parseKind(url.searchParams.get("kind"));
  const width = Number(url.searchParams.get("w") ?? "0");
  const version = url.searchParams.get("v");

  if (!slug?.trim() || !kind) {
    return new Response(null, { status: 404 });
  }

  const asset = await resolvePublicProfileImageAsset({
    slug,
    kind,
    width,
    version,
  });

  if (!asset) {
    return new Response(null, { status: 404 });
  }

  return publicProfileImageResponse(asset, request);
}

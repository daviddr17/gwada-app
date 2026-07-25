import "server-only";

import { createHash } from "node:crypto";
import sharp from "sharp";
import { unstable_cache } from "next/cache";
import {
  RESTAURANT_PROFILE_IMAGES_BUCKET,
  type RestaurantProfileImageKind,
} from "@/lib/restaurant/restaurant-profile-image";
import { normalizeRestaurantSlugInput } from "@/lib/restaurant/restaurant-slug";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type PublicProfileImageAsset = {
  body: Buffer;
  contentType: "image/webp";
  etag: string;
};

const COVER_MAX_W = 1280;
const AVATAR_MAX_W = 256;

function clampWidth(kind: RestaurantProfileImageKind, raw: number): number {
  const n = Number.isFinite(raw) ? Math.round(raw) : 0;
  if (kind === "cover") {
    if (n <= 640) return 640;
    if (n <= 960) return 960;
    return COVER_MAX_W;
  }
  if (n <= 128) return 128;
  return AVATAR_MAX_W;
}

async function loadAndResizeProfileImage(params: {
  storagePath: string;
  kind: RestaurantProfileImageKind;
  width: number;
}): Promise<PublicProfileImageAsset | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin.storage
    .from(RESTAURANT_PROFILE_IMAGES_BUCKET)
    .download(params.storagePath);

  if (error || !data) {
    console.warn(
      "[gwada] public-profile-image download",
      error?.message ?? "empty",
    );
    return null;
  }

  const input = Buffer.from(await data.arrayBuffer());
  if (!input.byteLength) return null;

  const width = clampWidth(params.kind, params.width);
  let pipeline = sharp(input, { failOn: "none" }).rotate();

  if (params.kind === "cover") {
    pipeline = pipeline
      .resize(width, null, { fit: "inside", withoutEnlargement: true })
      .flatten({ background: { r: 255, g: 255, b: 255 } });
  } else {
    pipeline = pipeline.resize(width, width, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  const body = await pipeline
    .webp({
      quality: params.kind === "cover" ? 78 : 84,
      effort: 4,
      ...(params.kind === "avatar" ? { alphaQuality: 100 } : {}),
    })
    .toBuffer();

  const hash = createHash("sha1").update(body).digest("hex").slice(0, 16);
  return {
    body,
    contentType: "image/webp",
    etag: `"ppimg:${params.kind}:${width}:${hash}"`,
  };
}

export async function resolvePublicProfileImageAsset(params: {
  slug: string;
  kind: RestaurantProfileImageKind;
  width: number;
  version?: string | null;
}): Promise<PublicProfileImageAsset | null> {
  const slug = normalizeRestaurantSlugInput(params.slug);
  if (!slug) return null;

  const width = clampWidth(params.kind, params.width);
  const version = params.version?.trim() || "0";

  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const { data: row, error } = await admin
    .from("restaurants")
    .select("is_published, avatar_storage_path, cover_storage_path")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !row?.is_published) return null;

  const storagePath =
    params.kind === "cover"
      ? (row.cover_storage_path as string | null)
      : (row.avatar_storage_path as string | null);
  const trimmed = storagePath?.trim();
  if (!trimmed) return null;

  const cached = unstable_cache(
    async () =>
      loadAndResizeProfileImage({
        storagePath: trimmed,
        kind: params.kind,
        width,
      }),
    ["public-profile-image", slug, params.kind, String(width), version, trimmed],
    {
      revalidate: 3600,
      tags: [
        `public-profile-image:${slug}`,
        `public-profile-image:${slug}:${params.kind}`,
      ],
    },
  );

  return cached();
}

export function publicProfileImageResponse(
  asset: PublicProfileImageAsset,
  request: Request,
): Response {
  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch === asset.etag) {
    return new Response(null, { status: 304 });
  }

  return new Response(new Uint8Array(asset.body), {
    headers: {
      "Content-Type": asset.contentType,
      "Cache-Control":
        "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800",
      ETag: asset.etag,
      Vary: "Accept-Encoding",
    },
  });
}

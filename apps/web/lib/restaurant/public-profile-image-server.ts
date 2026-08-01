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

/** Signalisiert Miss — darf nicht in unstable_cache landen. */
class PublicProfileImageMissError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "PublicProfileImageMissError";
  }
}

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
}): Promise<PublicProfileImageAsset> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new PublicProfileImageMissError("admin_missing");
  }

  const { data, error } = await admin.storage
    .from(RESTAURANT_PROFILE_IMAGES_BUCKET)
    .download(params.storagePath);

  if (error || !data) {
    console.warn(
      "[gwada] public-profile-image download",
      error?.message ?? "empty",
    );
    throw new PublicProfileImageMissError("download_failed");
  }

  let input: Buffer;
  try {
    input = Buffer.from(await data.arrayBuffer());
  } catch (err) {
    console.warn(
      "[gwada] public-profile-image read",
      err instanceof Error ? err.message : "read_failed",
    );
    throw new PublicProfileImageMissError("read_failed");
  }

  if (!input.byteLength) {
    throw new PublicProfileImageMissError("empty_body");
  }

  const width = clampWidth(params.kind, params.width);

  try {
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

    if (!body.byteLength) {
      throw new PublicProfileImageMissError("encode_empty");
    }

    const hash = createHash("sha1").update(body).digest("hex").slice(0, 16);
    return {
      body,
      contentType: "image/webp",
      etag: `"ppimg:${params.kind}:${width}:${hash}"`,
    };
  } catch (err) {
    if (err instanceof PublicProfileImageMissError) throw err;
    console.warn(
      "[gwada] public-profile-image sharp",
      err instanceof Error ? err.message : "sharp_failed",
    );
    throw new PublicProfileImageMissError("sharp_failed");
  }
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

  // Nur Erfolge cachen — Miss/Fehler werfen, damit kein 1h-404 in unstable_cache klebt.
  // Key v2: invalidiert ggf. früher gecachte `null`-Misses.
  const cached = unstable_cache(
    async () =>
      loadAndResizeProfileImage({
        storagePath: trimmed,
        kind: params.kind,
        width,
      }),
    [
      "public-profile-image-v2",
      slug,
      params.kind,
      String(width),
      version,
      trimmed,
    ],
    {
      revalidate: 3600,
      tags: [
        `public-profile-image:${slug}`,
        `public-profile-image:${slug}:${params.kind}`,
      ],
    },
  );

  try {
    return await cached();
  } catch (err) {
    if (
      err instanceof PublicProfileImageMissError ||
      (err instanceof Error && err.name === "PublicProfileImageMissError")
    ) {
      return null;
    }
    console.warn(
      "[gwada] public-profile-image cache",
      err instanceof Error ? err.message : "cache_failed",
    );
    return null;
  }
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

import "server-only";

import sharp from "sharp";
import type { RestaurantProfileImageKind } from "@/lib/restaurant/restaurant-profile-image";

export const RESTAURANT_PROFILE_IMAGE_OUTPUT_MIME = "image/webp";
export const RESTAURANT_PROFILE_IMAGE_OUTPUT_EXT = "webp";

/** Titelbild — max. Breite für öffentliches Profil (PageSpeed). */
const COVER_MAX_WIDTH_PX = 1920;
const COVER_WEBP_QUALITY = 82;

/** Logo/Avatar — Transparenz (Alpha) bleibt erhalten. */
const AVATAR_MAX_PX = 512;
const AVATAR_WEBP_QUALITY = 85;

export async function processRestaurantProfileImageUpload(
  input: Buffer,
  kind: RestaurantProfileImageKind,
): Promise<Buffer> {
  const base = sharp(input, { failOn: "none" }).rotate();

  if (kind === "cover") {
    return base
      .resize(COVER_MAX_WIDTH_PX, null, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .webp({ quality: COVER_WEBP_QUALITY, effort: 4 })
      .toBuffer();
  }

  return base
    .resize(AVATAR_MAX_PX, AVATAR_MAX_PX, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({
      quality: AVATAR_WEBP_QUALITY,
      effort: 4,
      alphaQuality: 100,
    })
    .toBuffer();
}

/** Alte JPG/PNG-Varianten nach WebP-Migration entfernen. */
export function legacyRestaurantProfileImagePaths(
  restaurantId: string,
  kind: RestaurantProfileImageKind,
): string[] {
  return ["jpg", "jpeg", "png"].map(
    (ext) => `${restaurantId}/${kind}.${ext}`,
  );
}

import type { RestaurantProfileImageKind } from "@/lib/restaurant/restaurant-profile-image";

/** Display-Breiten für Cover (CSS ~max 768–1024px @2x). */
export const PUBLIC_PROFILE_COVER_WIDTHS = [640, 960, 1280] as const;
/** Display-Breiten für Avatar (CSS ~80–128px @2x–3x). */
export const PUBLIC_PROFILE_AVATAR_WIDTHS = [128, 256] as const;

export const PUBLIC_PROFILE_COVER_DEFAULT_WIDTH = 960;
export const PUBLIC_PROFILE_AVATAR_DEFAULT_WIDTH = 256;

/** CSS sizes für Cover — Hero + LCP-preload müssen übereinstimmen. */
export const PUBLIC_PROFILE_COVER_SIZES =
  "(max-width: 640px) 100vw, (max-width: 1024px) 36rem, 48rem";
export const PUBLIC_PROFILE_AVATAR_SIZES = "128px";

export function buildPublicProfileImagePath(params: {
  slug: string;
  kind: RestaurantProfileImageKind;
  width: number;
  /** Cache-Bust (z. B. updated_at epoch seconds). */
  version?: string | number | null;
}): string {
  const q = new URLSearchParams({
    slug: params.slug,
    kind: params.kind,
    w: String(params.width),
  });
  if (params.version != null && String(params.version).trim()) {
    q.set("v", String(params.version).trim());
  }
  return `/api/public/profile-image?${q.toString()}`;
}

export function buildPublicProfileImageSrcSet(params: {
  slug: string;
  kind: RestaurantProfileImageKind;
  widths: readonly number[];
  version?: string | number | null;
}): string {
  return params.widths
    .map(
      (w) =>
        `${buildPublicProfileImagePath({
          slug: params.slug,
          kind: params.kind,
          width: w,
          version: params.version,
        })} ${w}w`,
    )
    .join(", ");
}

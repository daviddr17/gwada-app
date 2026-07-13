export const GALLERY_PLATFORMS = [
  "gwada",
  "facebook",
  "instagram",
  "google_business",
  "tripadvisor",
] as const;

export type GalleryPlatform = (typeof GALLERY_PLATFORMS)[number];

export const GALLERY_PLATFORM_LABELS: Record<GalleryPlatform, string> = {
  gwada: "Gwada",
  facebook: "Facebook",
  instagram: "Instagram",
  google_business: "Google",
  tripadvisor: "TripAdvisor",
};

export const GALLERY_PLATFORM_ORDER: readonly GalleryPlatform[] =
  GALLERY_PLATFORMS;

export const GALLERY_FILTER_ALL = "all" as const;

export type GalleryPlatformFilter = typeof GALLERY_FILTER_ALL | GalleryPlatform;

export const GALLERY_FILTER_LABELS: Record<GalleryPlatformFilter, string> = {
  all: "Alle",
  ...GALLERY_PLATFORM_LABELS,
};

export function isGalleryPlatform(value: string): value is GalleryPlatform {
  return (GALLERY_PLATFORMS as readonly string[]).includes(value);
}

export function isGalleryPlatformFilter(
  value: string,
): value is GalleryPlatformFilter {
  return value === GALLERY_FILTER_ALL || isGalleryPlatform(value);
}

export function parseGalleryPlatformFilter(
  platformParam: string | null,
): GalleryPlatformFilter {
  if (!platformParam || platformParam === GALLERY_FILTER_ALL) {
    return GALLERY_FILTER_ALL;
  }
  if (isGalleryPlatform(platformParam)) {
    return platformParam;
  }
  return GALLERY_FILTER_ALL;
}

export const GALLERY_CATEGORY_ALL = "all" as const;

export type GalleryCategoryFilter = typeof GALLERY_CATEGORY_ALL | string;

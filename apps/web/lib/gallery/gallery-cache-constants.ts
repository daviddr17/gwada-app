import "server-only";

import type { GalleryPlatform } from "@/lib/constants/gallery-platforms";

/** Externe Plattformen mit DB-Cache (Gwada in gwada_gallery_items). */
export const GALLERY_CACHEABLE_PLATFORMS = [
  "facebook",
  "instagram",
  "google_business",
  "tripadvisor",
] as const satisfies readonly GalleryPlatform[];

export type GalleryCacheablePlatform = (typeof GALLERY_CACHEABLE_PLATFORMS)[number];

/** Facebook, Instagram, Google Business — 1× pro Tag (Fotos ändern sich selten). */
export const GALLERY_CACHE_STALE_MS = 24 * 60 * 60 * 1000;

/** TripAdvisor (Terra API): 1× pro Woche. */
export const GALLERY_CACHE_STALE_TRIPADVISOR_MS = 7 * 24 * 60 * 60 * 1000;

/** Nach Fehler oder leerem TripAdvisor-Cache früher erneut syncen. */
export const GALLERY_CACHE_RETRY_MS = 60 * 60 * 1000;

export function galleryFeedSyncStaleMs(platform: GalleryCacheablePlatform): number {
  if (platform === "tripadvisor") return GALLERY_CACHE_STALE_TRIPADVISOR_MS;
  return GALLERY_CACHE_STALE_MS;
}

export type GalleryFeedSyncStaleOpts = {
  lastError?: string | null;
  itemCount?: number | null;
};

export function isGalleryFeedSyncStale(
  syncedAt: string | null | undefined,
  platform: GalleryCacheablePlatform,
  opts?: GalleryFeedSyncStaleOpts,
): boolean {
  if (!syncedAt) return true;
  const ageMs = Date.now() - new Date(syncedAt).getTime();
  if (opts?.lastError) {
    return ageMs > GALLERY_CACHE_RETRY_MS;
  }
  if (platform === "tripadvisor" && (opts?.itemCount ?? 0) === 0) {
    return ageMs > GALLERY_CACHE_RETRY_MS;
  }
  return ageMs > galleryFeedSyncStaleMs(platform);
}

export function isGalleryCacheablePlatform(
  platform: GalleryPlatform,
): platform is GalleryCacheablePlatform {
  return (GALLERY_CACHEABLE_PLATFORMS as readonly string[]).includes(platform);
}

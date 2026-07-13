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

export const GALLERY_CACHE_STALE_MS = 10 * 60 * 1000;

export function isGalleryFeedSyncStale(
  syncedAt: string | null | undefined,
): boolean {
  if (!syncedAt) return true;
  return Date.now() - new Date(syncedAt).getTime() > GALLERY_CACHE_STALE_MS;
}

export function isGalleryCacheablePlatform(
  platform: GalleryPlatform,
): platform is GalleryCacheablePlatform {
  return (GALLERY_CACHEABLE_PLATFORMS as readonly string[]).includes(platform);
}

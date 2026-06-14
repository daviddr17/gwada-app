import type { GalleryCacheablePlatform } from "@/lib/gallery/gallery-cache-constants";

export type GalleryFeedSyncMeta = {
  lastSyncedAt: string | null;
  stale: boolean;
  platformErrors: Partial<Record<GalleryCacheablePlatform, string>>;
  platformItemCounts: Partial<Record<GalleryCacheablePlatform, number>>;
};

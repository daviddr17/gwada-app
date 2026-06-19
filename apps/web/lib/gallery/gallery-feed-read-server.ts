import "server-only";

import type { GalleryPlatform } from "@/lib/constants/gallery-platforms";
import { GALLERY_PLATFORMS } from "@/lib/constants/gallery-platforms";
import {
  isGalleryCacheablePlatform,
  isGalleryFeedSyncStale,
  type GalleryCacheablePlatform,
} from "@/lib/gallery/gallery-cache-constants";
import {
  readCachedGalleryItems,
  readGalleryPlatformSyncState,
} from "@/lib/gallery/gallery-cache-db";
import { gwadaGalleryConnector } from "@/lib/gallery/connectors/gwada-gallery-connector";
import type { GalleryFeedSyncMeta } from "@/lib/gallery/gallery-feed-sync-meta";
import { readGwadaGalleryHighlights } from "@/lib/gallery/gallery-highlights-server";
import type {
  GalleryCategoryOption,
  UnifiedGalleryHighlight,
  UnifiedGalleryItem,
} from "@/lib/gallery/unified-gallery-item";
import { compareFeedItemsWithPinFirst } from "@/lib/feed-pin/feed-pin-types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type { GalleryFeedSyncMeta } from "@/lib/gallery/gallery-feed-sync-meta";

function resolvePlatforms(platforms?: GalleryPlatform[]): GalleryPlatform[] {
  return platforms?.length ? platforms : [...GALLERY_PLATFORMS];
}

function sortGalleryItems(items: UnifiedGalleryItem[]): UnifiedGalleryItem[] {
  return [...items].sort((a, b) =>
    compareFeedItemsWithPinFirst(a, b, (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    ),
  );
}

function buildCategoryOptions(items: UnifiedGalleryItem[]): GalleryCategoryOption[] {
  const map = new Map<string, GalleryCategoryOption>();
  for (const item of items) {
    if (!item.category || !item.categoryLabel) continue;
    const key = `${item.platform}:${item.category}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(key, {
        key: item.category,
        label: item.categoryLabel,
        platform: item.platform,
        count: 1,
      });
    }
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, "de"));
}

function buildSyncMeta(
  syncRows: Awaited<ReturnType<typeof readGalleryPlatformSyncState>>,
  requestedCacheable: GalleryCacheablePlatform[],
): GalleryFeedSyncMeta {
  const platformErrors: Partial<Record<GalleryCacheablePlatform, string>> = {};
  const platformItemCounts: Partial<Record<GalleryCacheablePlatform, number>> = {};
  let lastSyncedAt: string | null = null;

  for (const row of syncRows) {
    platformItemCounts[row.platform] = row.item_count;
    if (row.last_error) platformErrors[row.platform] = row.last_error;
    if (row.synced_at) {
      if (!lastSyncedAt || new Date(row.synced_at) > new Date(lastSyncedAt)) {
        lastSyncedAt = row.synced_at;
      }
    }
  }

  const syncByPlatform = new Map(syncRows.map((row) => [row.platform, row]));
  const stale = requestedCacheable.some((platform) => {
    const row = syncByPlatform.get(platform);
    if (!row) return true;
    return isGalleryFeedSyncStale(row.synced_at);
  });

  return { lastSyncedAt, stale, platformErrors, platformItemCounts };
}

export async function readGalleryFeedFromCache(
  restaurantId: string,
  sb: SupabaseClient,
  platforms?: GalleryPlatform[],
): Promise<{
  items: UnifiedGalleryItem[];
  highlights: UnifiedGalleryHighlight[];
  categories: GalleryCategoryOption[];
  sync: GalleryFeedSyncMeta;
}> {
  const keys = resolvePlatforms(platforms);
  const includeGwada = keys.includes("gwada");
  const cacheable = keys.filter(isGalleryCacheablePlatform);

  const [gwadaResult, cachedItems, syncRows, highlights] = await Promise.all([
    includeGwada
      ? gwadaGalleryConnector.fetchGalleryItems(restaurantId, sb)
      : Promise.resolve({ items: [] as UnifiedGalleryItem[] }),
    cacheable.length > 0
      ? readCachedGalleryItems(sb, restaurantId, cacheable)
      : Promise.resolve([] as UnifiedGalleryItem[]),
    cacheable.length > 0
      ? readGalleryPlatformSyncState(sb, restaurantId, cacheable)
      : Promise.resolve([]),
    includeGwada
      ? readGwadaGalleryHighlights(restaurantId, sb)
      : Promise.resolve([] as UnifiedGalleryHighlight[]),
  ]);

  const gwadaItems =
    includeGwada && !("error" in gwadaResult) ? gwadaResult.items : [];
  const items = sortGalleryItems([...gwadaItems, ...cachedItems]);

  return {
    items,
    highlights,
    categories: buildCategoryOptions(items),
    sync: buildSyncMeta(syncRows, cacheable),
  };
}

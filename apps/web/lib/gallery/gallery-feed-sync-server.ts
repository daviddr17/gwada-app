import "server-only";

import type { GalleryPlatform } from "@/lib/constants/gallery-platforms";
import {
  GALLERY_CACHEABLE_PLATFORMS,
  isGalleryCacheablePlatform,
  isGalleryFeedSyncStale,
  type GalleryCacheablePlatform,
} from "@/lib/gallery/gallery-cache-constants";
import { upsertGalleryPlatformCache } from "@/lib/gallery/gallery-cache-db";
import { getGalleryConnector } from "@/lib/gallery/connectors/registry";
import { isFeedConnectorEnabledBySuperadmin } from "@/lib/platform-feed/feed-platform-superadmin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchPlatformMessagingFlags } from "@/lib/supabase/platform-messaging-db";
import type { SupabaseClient } from "@supabase/supabase-js";

const inFlightSync = new Set<string>();

function syncLockKey(restaurantId: string, platform: GalleryCacheablePlatform): string {
  return `${restaurantId}:${platform}`;
}

export async function syncRestaurantGalleryPlatform(
  admin: SupabaseClient,
  restaurantId: string,
  platform: GalleryCacheablePlatform,
): Promise<{ ok: boolean; error?: string; count: number }> {
  const lockKey = syncLockKey(restaurantId, platform);
  if (inFlightSync.has(lockKey)) return { ok: true, count: 0 };
  inFlightSync.add(lockKey);

  try {
    const connector = getGalleryConnector(platform);
    if (!connector.capabilities.canReadGallery) return { ok: true, count: 0 };

    const flags = await fetchPlatformMessagingFlags(admin);
    if (!isFeedConnectorEnabledBySuperadmin(platform, flags)) {
      await upsertGalleryPlatformCache(admin, restaurantId, platform, [], new Date().toISOString(), null);
      return { ok: true, count: 0 };
    }

    const connected = await connector.isConnected(restaurantId);
    const syncedAt = new Date().toISOString();

    if (!connected) {
      await upsertGalleryPlatformCache(admin, restaurantId, platform, [], syncedAt, null);
      return { ok: true, count: 0 };
    }

    const result = await connector.fetchGalleryItems(restaurantId, admin);
    if ("error" in result) {
      await upsertGalleryPlatformCache(
        admin,
        restaurantId,
        platform,
        [],
        syncedAt,
        result.error,
      );
      return { ok: false, error: result.error, count: 0 };
    }

    await upsertGalleryPlatformCache(
      admin,
      restaurantId,
      platform,
      result.items,
      syncedAt,
      null,
    );
    return { ok: true, count: result.items.length };
  } finally {
    inFlightSync.delete(lockKey);
  }
}

export async function syncRestaurantGalleryPlatforms(
  admin: SupabaseClient,
  restaurantId: string,
  platforms?: GalleryCacheablePlatform[],
): Promise<{ synced: number; errors: string[] }> {
  const keys = platforms ?? [...GALLERY_CACHEABLE_PLATFORMS];
  const stats = { synced: 0, errors: [] as string[] };

  await Promise.all(
    keys.map(async (platform) => {
      const result = await syncRestaurantGalleryPlatform(admin, restaurantId, platform);
      if (result.ok) stats.synced += result.count;
      else if (result.error) stats.errors.push(`${platform}:${result.error}`);
    }),
  );

  return stats;
}

export async function triggerGalleryFeedSyncIfStale(
  restaurantId: string,
  platforms?: GalleryPlatform[],
): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;

  const cacheable = (platforms ?? [...GALLERY_CACHEABLE_PLATFORMS]).filter(
    isGalleryCacheablePlatform,
  );
  if (cacheable.length === 0) return;

  const { data } = await admin
    .from("restaurant_gallery_platform_sync")
    .select("platform, synced_at")
    .eq("restaurant_id", restaurantId)
    .in("platform", cacheable);

  const syncedByPlatform = new Map(
    (data ?? []).map((row) => [row.platform as string, row.synced_at as string | null]),
  );

  const stale = cacheable.filter((platform) =>
    isGalleryFeedSyncStale(syncedByPlatform.get(platform), platform),
  );
  if (stale.length === 0) return;

  await syncRestaurantGalleryPlatforms(admin, restaurantId, stale);
}

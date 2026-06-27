import "server-only";

import type { NewsPlatform } from "@/lib/constants/news-platforms";
import {
  NEWS_CACHEABLE_PLATFORMS,
  isNewsFeedSyncStale,
  isNewsCacheablePlatform,
  type NewsCacheablePlatform,
} from "@/lib/news/news-cache-constants";
import { upsertNewsPlatformCache } from "@/lib/news/news-cache-db";
import { getNewsConnector } from "@/lib/news/connectors/registry";
import { isFeedConnectorEnabledBySuperadmin } from "@/lib/platform-feed/feed-platform-superadmin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchPlatformMessagingFlags } from "@/lib/supabase/platform-messaging-db";
import type { SupabaseClient } from "@supabase/supabase-js";

const inFlightSync = new Set<string>();

function syncLockKey(restaurantId: string, platform: NewsCacheablePlatform): string {
  return `${restaurantId}:${platform}`;
}

export async function syncRestaurantNewsPlatform(
  admin: SupabaseClient,
  restaurantId: string,
  platform: NewsCacheablePlatform,
): Promise<{ ok: boolean; error?: string; count: number }> {
  const lockKey = syncLockKey(restaurantId, platform);
  if (inFlightSync.has(lockKey)) {
    return { ok: true, count: 0 };
  }
  inFlightSync.add(lockKey);

  try {
    const connector = getNewsConnector(platform);
    if (!connector.capabilities.canReadFeed) {
      return { ok: true, count: 0 };
    }

    const flags = await fetchPlatformMessagingFlags(admin);
    if (!isFeedConnectorEnabledBySuperadmin(platform, flags)) {
      await upsertNewsPlatformCache(admin, restaurantId, platform, [], new Date().toISOString(), null);
      return { ok: true, count: 0 };
    }

    const connected = await connector.isConnected(restaurantId);
    const syncedAt = new Date().toISOString();

    if (!connected) {
      await upsertNewsPlatformCache(admin, restaurantId, platform, [], syncedAt, null);
      return { ok: true, count: 0 };
    }

    const result = await connector.fetchFeed(restaurantId, admin);
    if ("error" in result) {
      await upsertNewsPlatformCache(
        admin,
        restaurantId,
        platform,
        [],
        syncedAt,
        result.error,
      );
      return { ok: false, error: result.error, count: 0 };
    }

    await upsertNewsPlatformCache(
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

export async function syncRestaurantNewsPlatforms(
  admin: SupabaseClient,
  restaurantId: string,
  platforms?: NewsCacheablePlatform[],
): Promise<{ synced: number; errors: string[] }> {
  const keys = platforms ?? [...NEWS_CACHEABLE_PLATFORMS];
  const stats = { synced: 0, errors: [] as string[] };

  await Promise.all(
    keys.map(async (platform) => {
      const result = await syncRestaurantNewsPlatform(admin, restaurantId, platform);
      if (result.ok) {
        stats.synced += result.count;
      } else if (result.error) {
        stats.errors.push(`${platform}:${result.error}`);
      }
    }),
  );

  return stats;
}

export async function triggerNewsFeedSyncIfStale(
  restaurantId: string,
  platforms?: NewsPlatform[],
): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;

  const cacheable = (platforms ?? [...NEWS_CACHEABLE_PLATFORMS]).filter(
    isNewsCacheablePlatform,
  );
  if (cacheable.length === 0) return;

  const { data } = await admin
    .from("restaurant_news_platform_sync")
    .select("platform, synced_at")
    .eq("restaurant_id", restaurantId)
    .in("platform", cacheable);

  const syncedByPlatform = new Map(
    (data ?? []).map((row) => [row.platform as string, row.synced_at as string | null]),
  );

  const stale = cacheable.filter((platform) =>
    isNewsFeedSyncStale(syncedByPlatform.get(platform)),
  );
  if (stale.length === 0) return;

  await syncRestaurantNewsPlatforms(admin, restaurantId, stale);
}

export async function syncRestaurantNewsPlatformAfterPublish(
  restaurantId: string,
  platform: NewsPlatform,
): Promise<void> {
  if (!isNewsCacheablePlatform(platform)) return;
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  await syncRestaurantNewsPlatform(admin, restaurantId, platform);
}

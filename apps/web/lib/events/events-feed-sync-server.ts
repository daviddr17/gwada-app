import "server-only";

import type { EventsPlatform } from "@/lib/constants/events-platforms";
import {
  EVENTS_CACHEABLE_PLATFORMS,
  isEventsCacheablePlatform,
  type EventsCacheablePlatform,
} from "@/lib/constants/events-platforms";
import { upsertEventsPlatformCache } from "@/lib/events/events-cache-db";
import { isEventsFeedSyncStale } from "@/lib/events/events-cache-constants";
import { getEventsConnector } from "@/lib/events/connectors/registry";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

const inFlightSync = new Set<string>();

function syncLockKey(restaurantId: string, platform: EventsCacheablePlatform): string {
  return `${restaurantId}:${platform}`;
}

export async function syncRestaurantEventsPlatform(
  admin: SupabaseClient,
  restaurantId: string,
  platform: EventsCacheablePlatform,
): Promise<{ ok: boolean; error?: string; count: number }> {
  const lockKey = syncLockKey(restaurantId, platform);
  if (inFlightSync.has(lockKey)) {
    return { ok: true, count: 0 };
  }
  inFlightSync.add(lockKey);

  try {
    const connector = getEventsConnector(platform);
    if (!connector.capabilities.canReadFeed) {
      return { ok: true, count: 0 };
    }

    const connected = await connector.isConnected(restaurantId);
    const syncedAt = new Date().toISOString();

    if (!connected) {
      await upsertEventsPlatformCache(admin, restaurantId, platform, [], syncedAt, null);
      return { ok: true, count: 0 };
    }

    const result = await connector.fetchFeed(restaurantId, admin);
    if ("error" in result) {
      await upsertEventsPlatformCache(
        admin,
        restaurantId,
        platform,
        [],
        syncedAt,
        result.error,
      );
      return { ok: false, error: result.error, count: 0 };
    }

    await upsertEventsPlatformCache(
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

export async function syncRestaurantEventsPlatforms(
  admin: SupabaseClient,
  restaurantId: string,
  platforms?: EventsCacheablePlatform[],
): Promise<{ synced: number; errors: string[] }> {
  const keys = platforms ?? [...EVENTS_CACHEABLE_PLATFORMS];
  const stats = { synced: 0, errors: [] as string[] };

  await Promise.all(
    keys.map(async (platform) => {
      const result = await syncRestaurantEventsPlatform(admin, restaurantId, platform);
      if (result.ok) {
        stats.synced += result.count;
      } else if (result.error) {
        stats.errors.push(`${platform}:${result.error}`);
      }
    }),
  );

  return stats;
}

export async function triggerEventsFeedSyncIfStale(
  restaurantId: string,
  platforms?: EventsPlatform[],
): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;

  const cacheable = (platforms ?? [...EVENTS_CACHEABLE_PLATFORMS]).filter(
    isEventsCacheablePlatform,
  );
  if (cacheable.length === 0) return;

  const { data } = await admin
    .from("restaurant_events_platform_sync")
    .select("platform, synced_at")
    .eq("restaurant_id", restaurantId)
    .in("platform", cacheable);

  const syncedByPlatform = new Map(
    (data ?? []).map((row) => [row.platform as string, row.synced_at as string | null]),
  );

  const stale = cacheable.filter((platform) =>
    isEventsFeedSyncStale(syncedByPlatform.get(platform)),
  );
  if (stale.length === 0) return;

  await syncRestaurantEventsPlatforms(admin, restaurantId, stale);
}

export async function syncRestaurantEventsPlatformAfterPublish(
  restaurantId: string,
  platform: EventsPlatform,
): Promise<void> {
  if (!isEventsCacheablePlatform(platform)) return;
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  await syncRestaurantEventsPlatform(admin, restaurantId, platform);
}

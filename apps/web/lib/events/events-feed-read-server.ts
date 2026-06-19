import "server-only";

import {
  EVENTS_CACHEABLE_PLATFORMS,
  EVENTS_PLATFORMS,
  isEventsCacheablePlatform,
  type EventsCacheablePlatform,
  type EventsPlatform,
} from "@/lib/constants/events-platforms";
import { gwadaEventsConnector } from "@/lib/events/connectors/gwada-connector";
import {
  readCachedEventsItems,
  readEventsPlatformSyncState,
} from "@/lib/events/events-cache-db";
import { isEventsFeedSyncStale } from "@/lib/events/events-cache-constants";
import { sortEventsByStartAt } from "@/lib/events/format-events-display-date";
import type { EventsFeedSyncMeta } from "@/lib/events/events-feed-sync-meta";
import type { UnifiedEventItem } from "@/lib/events/unified-event-item";
import type { SupabaseClient } from "@supabase/supabase-js";

export type { EventsFeedSyncMeta } from "@/lib/events/events-feed-sync-meta";

function resolvePlatforms(platforms?: EventsPlatform[]): EventsPlatform[] {
  return platforms?.length ? platforms : [...EVENTS_PLATFORMS];
}

function buildSyncMeta(
  syncRows: Awaited<ReturnType<typeof readEventsPlatformSyncState>>,
  requestedCacheable: EventsCacheablePlatform[],
): EventsFeedSyncMeta {
  const platformErrors: Partial<Record<EventsCacheablePlatform, string>> = {};
  const platformItemCounts: Partial<Record<EventsCacheablePlatform, number>> = {};
  let lastSyncedAt: string | null = null;

  for (const row of syncRows) {
    platformItemCounts[row.platform] = row.item_count;
    if (row.last_error) {
      platformErrors[row.platform] = row.last_error;
    }
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
    return isEventsFeedSyncStale(row.synced_at);
  });

  return { lastSyncedAt, stale, platformErrors, platformItemCounts };
}

export async function readEventsFeedFromCache(
  restaurantId: string,
  sb: SupabaseClient,
  platforms?: EventsPlatform[],
): Promise<{ items: UnifiedEventItem[]; sync: EventsFeedSyncMeta }> {
  const keys = resolvePlatforms(platforms);
  const includeGwada = keys.includes("gwada");
  const cacheable = keys.filter(isEventsCacheablePlatform);

  const [gwadaResult, cachedItems, syncRows] = await Promise.all([
    includeGwada
      ? gwadaEventsConnector.fetchFeed(restaurantId, sb)
      : Promise.resolve({ items: [] as UnifiedEventItem[] }),
    cacheable.length > 0
      ? readCachedEventsItems(sb, restaurantId, cacheable)
      : Promise.resolve([] as UnifiedEventItem[]),
    cacheable.length > 0
      ? readEventsPlatformSyncState(sb, restaurantId, cacheable)
      : Promise.resolve([]),
  ]);

  const gwadaItems =
    includeGwada && !("error" in gwadaResult) ? gwadaResult.items : [];

  const items = sortEventsByStartAt([...gwadaItems, ...cachedItems]);
  const sync = buildSyncMeta(syncRows, cacheable);

  return { items, sync };
}

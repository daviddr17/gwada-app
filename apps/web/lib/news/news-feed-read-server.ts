import "server-only";

import type { NewsPlatform } from "@/lib/constants/news-platforms";
import { NEWS_PLATFORMS } from "@/lib/constants/news-platforms";
import {
  isNewsCacheablePlatform,
  isNewsFeedSyncStale,
  type NewsCacheablePlatform,
} from "@/lib/news/news-cache-constants";
import {
  readCachedNewsItems,
  readNewsPlatformSyncState,
} from "@/lib/news/news-cache-db";
import { gwadaNewsConnector } from "@/lib/news/connectors/gwada-connector";
import type { NewsFeedSyncMeta } from "@/lib/news/news-feed-sync-meta";
import type { UnifiedNewsItem } from "@/lib/news/unified-news-item";
import type { SupabaseClient } from "@supabase/supabase-js";

export type { NewsFeedSyncMeta } from "@/lib/news/news-feed-sync-meta";

function sortNewsItems(items: UnifiedNewsItem[]): UnifiedNewsItem[] {
  return [...items].sort(
    (a, b) =>
      new Date(b.publishedAt ?? b.createdAt).getTime() -
      new Date(a.publishedAt ?? a.createdAt).getTime(),
  );
}

function resolvePlatforms(platforms?: NewsPlatform[]): NewsPlatform[] {
  return platforms?.length ? platforms : [...NEWS_PLATFORMS];
}

function buildSyncMeta(
  syncRows: Awaited<ReturnType<typeof readNewsPlatformSyncState>>,
  requestedCacheable: NewsCacheablePlatform[],
): NewsFeedSyncMeta {
  const platformErrors: Partial<Record<NewsCacheablePlatform, string>> = {};
  let lastSyncedAt: string | null = null;

  for (const row of syncRows) {
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
    return isNewsFeedSyncStale(row.synced_at);
  });

  return { lastSyncedAt, stale, platformErrors };
}

export async function readNewsFeedFromCache(
  restaurantId: string,
  sb: SupabaseClient,
  platforms?: NewsPlatform[],
): Promise<{ items: UnifiedNewsItem[]; sync: NewsFeedSyncMeta }> {
  const keys = resolvePlatforms(platforms);
  const includeGwada = keys.includes("gwada");
  const cacheable = keys.filter(isNewsCacheablePlatform);

  const [gwadaResult, cachedItems, syncRows] = await Promise.all([
    includeGwada
      ? gwadaNewsConnector.fetchFeed(restaurantId, sb)
      : Promise.resolve({ items: [] as UnifiedNewsItem[] }),
    cacheable.length > 0
      ? readCachedNewsItems(sb, restaurantId, cacheable)
      : Promise.resolve([] as UnifiedNewsItem[]),
    cacheable.length > 0
      ? readNewsPlatformSyncState(sb, restaurantId, cacheable)
      : Promise.resolve([]),
  ]);

  const gwadaItems =
    includeGwada && !("error" in gwadaResult) ? gwadaResult.items : [];

  const items = sortNewsItems([...gwadaItems, ...cachedItems]);
  const sync = buildSyncMeta(syncRows, cacheable);

  return { items, sync };
}

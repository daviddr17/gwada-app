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
import { sortNewsItemsByDate } from "@/lib/news/format-news-display-date";
import type { MetaNewsMediaAudience } from "@/lib/news/meta-news-media-proxy";
import { resolveNewsFeedMetaMediaUrls } from "@/lib/news/meta-news-media-proxy";
import type { NewsFeedSyncMeta } from "@/lib/news/news-feed-sync-meta";
import type { UnifiedNewsItem } from "@/lib/news/unified-news-item";
import type { SupabaseClient } from "@supabase/supabase-js";

export type { NewsFeedSyncMeta } from "@/lib/news/news-feed-sync-meta";

function resolvePlatforms(platforms?: NewsPlatform[]): NewsPlatform[] {
  return platforms?.length ? platforms : [...NEWS_PLATFORMS];
}

function buildSyncMeta(
  syncRows: Awaited<ReturnType<typeof readNewsPlatformSyncState>>,
  requestedCacheable: NewsCacheablePlatform[],
): NewsFeedSyncMeta {
  const platformErrors: Partial<Record<NewsCacheablePlatform, string>> = {};
  const platformItemCounts: Partial<Record<NewsCacheablePlatform, number>> = {};
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
    return isNewsFeedSyncStale(row.synced_at);
  });

  return { lastSyncedAt, stale, platformErrors, platformItemCounts };
}

export async function readNewsFeedFromCache(
  restaurantId: string,
  sb: SupabaseClient,
  platforms?: NewsPlatform[],
  audience: MetaNewsMediaAudience = "app",
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

  const resolvedCachedItems = resolveNewsFeedMetaMediaUrls(
    restaurantId,
    cachedItems,
    audience,
  );

  const items = sortNewsItemsByDate([...gwadaItems, ...resolvedCachedItems]);
  const sync = buildSyncMeta(syncRows, cacheable);

  return { items, sync };
}

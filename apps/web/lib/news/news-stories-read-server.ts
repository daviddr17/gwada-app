import "server-only";

import { NEWS_PLATFORM_LABELS } from "@/lib/constants/news-platforms";
import {
  isNewsStoriesSyncStale,
  NEWS_STORIES_PLATFORMS,
  type NewsStoriesPlatform,
} from "@/lib/news/news-stories-cache-constants";
import {
  readCachedNewsStorySlides,
  readNewsStoriesPlatformSyncState,
} from "@/lib/news/news-stories-cache-db";
import type { MetaNewsMediaAudience } from "@/lib/news/meta-news-media-proxy";
import { resolveNewsStoriesMetaMediaUrls } from "@/lib/news/meta-news-media-proxy";
import type {
  NewsStoriesSyncMeta,
  UnifiedNewsStoryRing,
  UnifiedNewsStorySlide,
} from "@/lib/news/unified-news-story";
import type { SupabaseClient } from "@supabase/supabase-js";

function buildStoriesSyncMeta(
  syncRows: Awaited<ReturnType<typeof readNewsStoriesPlatformSyncState>>,
  requested: NewsStoriesPlatform[],
): NewsStoriesSyncMeta {
  const platformErrors: NewsStoriesSyncMeta["platformErrors"] = {};
  const platformItemCounts: NewsStoriesSyncMeta["platformItemCounts"] = {};
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
  const stale = requested.some((platform) => {
    const row = syncByPlatform.get(platform);
    if (!row) return true;
    return isNewsStoriesSyncStale(row.synced_at);
  });

  return { lastSyncedAt, stale, platformErrors, platformItemCounts };
}

function groupMetaSlidesIntoRings(
  slides: UnifiedNewsStorySlide[],
): UnifiedNewsStoryRing[] {
  const byPlatform = new Map<NewsStoriesPlatform, UnifiedNewsStorySlide[]>();

  for (const slide of slides) {
    if (slide.platform !== "facebook" && slide.platform !== "instagram") continue;
    const list = byPlatform.get(slide.platform) ?? [];
    list.push(slide);
    byPlatform.set(slide.platform, list);
  }

  const rings: UnifiedNewsStoryRing[] = [];

  for (const platform of NEWS_STORIES_PLATFORMS) {
    const platformSlides = byPlatform.get(platform);
    if (!platformSlides?.length) continue;
    const sorted = [...platformSlides].sort(
      (a, b) =>
        new Date(a.publishedAt ?? 0).getTime() -
        new Date(b.publishedAt ?? 0).getTime(),
    );
    const coverUrl = sorted[0]?.url;
    if (!coverUrl) continue;
    rings.push({
      id: `${platform}:stories`,
      platform,
      title: NEWS_PLATFORM_LABELS[platform],
      coverUrl,
      slideIds: sorted.map((s) => s.id),
      slides: sorted,
    });
  }

  return rings;
}

export async function readNewsStoriesFromCache(
  restaurantId: string,
  sb: SupabaseClient,
  audience: MetaNewsMediaAudience = "app",
): Promise<{
  storyRings: UnifiedNewsStoryRing[];
  storiesSync: NewsStoriesSyncMeta;
}> {
  const [cachedSlides, syncRows] = await Promise.all([
    readCachedNewsStorySlides(sb, restaurantId),
    readNewsStoriesPlatformSyncState(sb, restaurantId),
  ]);

  const resolvedSlides = resolveNewsStoriesMetaMediaUrls(
    restaurantId,
    cachedSlides,
    audience,
  );

  const storyRings = groupMetaSlidesIntoRings(resolvedSlides);
  const storiesSync = buildStoriesSyncMeta(syncRows, [...NEWS_STORIES_PLATFORMS]);

  return { storyRings, storiesSync };
}

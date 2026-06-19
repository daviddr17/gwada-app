import type { NewsPlatform } from "@/lib/constants/news-platforms";

export const NEWS_STORIES_PLATFORMS = ["facebook", "instagram"] as const satisfies readonly NewsPlatform[];

export type NewsStoriesPlatform = (typeof NEWS_STORIES_PLATFORMS)[number];

export const NEWS_STORIES_CACHE_STALE_MS = 10 * 60 * 1000;

export function isNewsStoriesPlatform(
  platform: NewsPlatform,
): platform is NewsStoriesPlatform {
  return (NEWS_STORIES_PLATFORMS as readonly string[]).includes(platform);
}

export function isNewsStoriesSyncStale(syncedAt: string | null | undefined): boolean {
  if (!syncedAt) return true;
  return Date.now() - new Date(syncedAt).getTime() > NEWS_STORIES_CACHE_STALE_MS;
}

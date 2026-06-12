import type { NewsCacheablePlatform } from "@/lib/news/news-cache-constants";

export type NewsFeedSyncMeta = {
  lastSyncedAt: string | null;
  stale: boolean;
  platformErrors: Partial<Record<NewsCacheablePlatform, string>>;
  platformItemCounts: Partial<Record<NewsCacheablePlatform, number>>;
};

import "server-only";

import type { ReviewStatisticsBundle } from "@/lib/supabase/reviews-analytics-db";

type CacheEntry = {
  revision: string;
  bundle: ReviewStatisticsBundle;
  at: number;
};

const cache = new Map<string, CacheEntry>();
const MAX_ENTRIES = 200;

function cacheKey(restaurantId: string, monthsBack: number): string {
  return `${restaurantId}:${monthsBack}`;
}

export function peekReviewStatisticsServerCache(
  restaurantId: string,
  monthsBack: number,
  revision: string,
): ReviewStatisticsBundle | null {
  const entry = cache.get(cacheKey(restaurantId, monthsBack));
  if (!entry || entry.revision !== revision) return null;
  return entry.bundle;
}

export function writeReviewStatisticsServerCache(
  restaurantId: string,
  monthsBack: number,
  revision: string,
  bundle: ReviewStatisticsBundle,
): void {
  const key = cacheKey(restaurantId, monthsBack);
  cache.set(key, { revision, bundle, at: Date.now() });

  if (cache.size <= MAX_ENTRIES) return;
  let oldestKey: string | null = null;
  let oldestAt = Infinity;
  for (const [k, v] of cache) {
    if (v.at < oldestAt) {
      oldestAt = v.at;
      oldestKey = k;
    }
  }
  if (oldestKey) cache.delete(oldestKey);
}

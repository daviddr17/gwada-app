import "server-only";

import type { ReviewPlatform } from "@/lib/constants/review-platforms";
import { REVIEW_PLATFORMS } from "@/lib/constants/review-platforms";
import {
  isReviewsCacheablePlatform,
  isReviewsFeedSyncStale,
  type ReviewsCacheablePlatform,
} from "@/lib/reviews/reviews-cache-constants";
import {
  readCachedReviews,
  readReviewsPlatformSyncState,
  type ReviewsPlatformSyncMeta,
  type ReviewsPlatformSyncRow,
} from "@/lib/reviews/reviews-cache-db";
import type { ReviewsFeedSyncMeta } from "@/lib/reviews/reviews-feed-sync-meta";
import type { UnifiedReview } from "@/lib/reviews/unified-review";
import type { SupabaseClient } from "@supabase/supabase-js";

export type { ReviewsFeedSyncMeta } from "@/lib/reviews/reviews-feed-sync-meta";

function resolvePlatforms(platforms?: ReviewPlatform[]): ReviewPlatform[] {
  return platforms?.length ? platforms : [...REVIEW_PLATFORMS];
}

function buildSyncMeta(
  syncRows: ReviewsPlatformSyncRow[],
  requestedCacheable: ReviewsCacheablePlatform[],
): ReviewsFeedSyncMeta {
  const platformErrors: Partial<Record<ReviewsCacheablePlatform, string>> = {};
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
    return isReviewsFeedSyncStale(row.synced_at, platform);
  });

  return { lastSyncedAt, stale, platformErrors };
}

export async function readReviewsFeedFromCache(
  restaurantId: string,
  sb: SupabaseClient,
  platforms?: ReviewPlatform[],
): Promise<{
  reviews: UnifiedReview[];
  sync: ReviewsFeedSyncMeta;
  syncRows: ReviewsPlatformSyncRow[];
}> {
  const keys = resolvePlatforms(platforms);
  const cacheable = keys.filter(isReviewsCacheablePlatform);

  const [cachedReviews, syncRows] = await Promise.all([
    cacheable.length > 0
      ? readCachedReviews(sb, restaurantId, cacheable)
      : Promise.resolve([] as UnifiedReview[]),
    cacheable.length > 0
      ? readReviewsPlatformSyncState(sb, restaurantId, cacheable)
      : Promise.resolve([] as ReviewsPlatformSyncRow[]),
  ]);

  const sync = buildSyncMeta(syncRows, cacheable);

  return { reviews: cachedReviews, sync, syncRows };
}

export function readPlatformSyncMeta(
  syncRows: ReviewsPlatformSyncRow[],
  platform: ReviewsCacheablePlatform,
): ReviewsPlatformSyncMeta {
  return syncRows.find((row) => row.platform === platform)?.meta ?? {};
}

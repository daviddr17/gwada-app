import "server-only";

import type { ReviewPlatform } from "@/lib/constants/review-platforms";
import {
  REVIEWS_CACHEABLE_PLATFORMS,
  isReviewsFeedSyncStale,
  isReviewsCacheablePlatform,
  type ReviewsCacheablePlatform,
} from "@/lib/reviews/reviews-cache-constants";
import {
  upsertReviewsPlatformCache,
  type ReviewsPlatformSyncMeta,
} from "@/lib/reviews/reviews-cache-db";
import { fetchFacebookReviewsForRestaurant } from "@/lib/reviews/facebook-reviews-api";
import { fetchGoogleReviewsForRestaurant } from "@/lib/reviews/google-reviews-api";
import { fetchTripadvisorReviewsForRestaurant } from "@/lib/reviews/tripadvisor-reviews-api";
import { GOOGLE_REVIEWS_PAGE_SIZE } from "@/lib/reviews/google-reviews-pagination";
import { isReviewsPlatformConnected, isReviewsCacheablePlatformEnabledBySuperadmin } from "@/lib/reviews/reviews-platform-connected-server";
import { fetchReviewPlatformMessagingFlags } from "@/lib/reviews/reviews-platform-availability-server";
import type { UnifiedReview } from "@/lib/reviews/unified-review";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

const inFlightSync = new Set<string>();
const GOOGLE_SYNC_MAX_PAGES = 10;

function syncLockKey(restaurantId: string, platform: ReviewsCacheablePlatform): string {
  return `${restaurantId}:${platform}`;
}

async function fetchAllGoogleReviewsForSync(
  restaurantId: string,
): Promise<
  | { reviews: UnifiedReview[]; meta: ReviewsPlatformSyncMeta }
  | { error: string }
> {
  let pageToken: string | null = null;
  let allReviews: UnifiedReview[] = [];
  let meta: ReviewsPlatformSyncMeta = {};

  for (let page = 0; page < GOOGLE_SYNC_MAX_PAGES; page++) {
    const result = await fetchGoogleReviewsForRestaurant(restaurantId, {
      pageToken,
      pageSize: GOOGLE_REVIEWS_PAGE_SIZE,
    });
    if ("error" in result) return result;

    allReviews = allReviews.concat(result.reviews);
    meta = {
      averageRating: result.pagination.averageRating,
      totalReviewCount: result.pagination.totalReviewCount,
    };

    if (!result.pagination.nextPageToken) break;
    pageToken = result.pagination.nextPageToken;
  }

  return { reviews: allReviews, meta };
}

async function fetchReviewsForPlatform(
  restaurantId: string,
  platform: ReviewsCacheablePlatform,
): Promise<
  | { reviews: UnifiedReview[]; meta: ReviewsPlatformSyncMeta }
  | { error: string }
> {
  if (platform === "google") {
    return fetchAllGoogleReviewsForSync(restaurantId);
  }
  if (platform === "tripadvisor") {
    const result = await fetchTripadvisorReviewsForRestaurant(restaurantId);
    if ("error" in result) return result;
    return {
      reviews: result.reviews,
      meta: { totalReviewCount: result.meta.totalReviewCount },
    };
  }
  const result = await fetchFacebookReviewsForRestaurant(restaurantId);
  if ("error" in result) return result;
  return {
    reviews: result.reviews,
    meta: { totalReviewCount: result.reviews.length },
  };
}

export async function syncRestaurantReviewsPlatform(
  admin: SupabaseClient,
  restaurantId: string,
  platform: ReviewsCacheablePlatform,
): Promise<{ ok: boolean; error?: string; count: number }> {
  const lockKey = syncLockKey(restaurantId, platform);
  if (inFlightSync.has(lockKey)) {
    return { ok: true, count: 0 };
  }
  inFlightSync.add(lockKey);

  try {
    const syncedAt = new Date().toISOString();
    const flags = await fetchReviewPlatformMessagingFlags(admin);
    if (!isReviewsCacheablePlatformEnabledBySuperadmin(platform, flags)) {
      await upsertReviewsPlatformCache(admin, restaurantId, platform, [], syncedAt, null, {});
      return { ok: true, count: 0 };
    }

    const connected = await isReviewsPlatformConnected(restaurantId, platform);

    if (!connected) {
      await upsertReviewsPlatformCache(
        admin,
        restaurantId,
        platform,
        [],
        syncedAt,
        null,
      );
      return { ok: true, count: 0 };
    }

    const result = await fetchReviewsForPlatform(restaurantId, platform);
    if ("error" in result) {
      await upsertReviewsPlatformCache(
        admin,
        restaurantId,
        platform,
        [],
        syncedAt,
        result.error,
      );
      return { ok: false, error: result.error, count: 0 };
    }

    await upsertReviewsPlatformCache(
      admin,
      restaurantId,
      platform,
      result.reviews,
      syncedAt,
      null,
      result.meta,
    );
    return { ok: true, count: result.reviews.length };
  } finally {
    inFlightSync.delete(lockKey);
  }
}

export async function syncRestaurantReviewsPlatforms(
  admin: SupabaseClient,
  restaurantId: string,
  platforms?: ReviewsCacheablePlatform[],
): Promise<{ synced: number; errors: string[] }> {
  const keys = platforms ?? [...REVIEWS_CACHEABLE_PLATFORMS];
  const stats = { synced: 0, errors: [] as string[] };

  await Promise.all(
    keys.map(async (platform) => {
      const result = await syncRestaurantReviewsPlatform(
        admin,
        restaurantId,
        platform,
      );
      if (result.ok) {
        stats.synced += result.count;
      } else if (result.error) {
        stats.errors.push(`${platform}:${result.error}`);
      }
    }),
  );

  return stats;
}

export async function listStaleReviewsPlatforms(
  admin: SupabaseClient,
  restaurantId: string,
  platforms?: ReviewsCacheablePlatform[],
): Promise<ReviewsCacheablePlatform[]> {
  const cacheable = platforms ?? [...REVIEWS_CACHEABLE_PLATFORMS];
  if (cacheable.length === 0) return [];

  const { data } = await admin
    .from("restaurant_reviews_platform_sync")
    .select("platform, synced_at, last_error, item_count")
    .eq("restaurant_id", restaurantId)
    .in("platform", cacheable);

  const syncedByPlatform = new Map(
    (data ?? []).map((row) => [
      row.platform as string,
      {
        syncedAt: row.synced_at as string | null,
        lastError: (row.last_error as string | null) ?? null,
        itemCount: Number(row.item_count ?? 0),
      },
    ]),
  );

  return cacheable.filter((platform) => {
    const row = syncedByPlatform.get(platform);
    return isReviewsFeedSyncStale(row?.syncedAt, platform, {
      lastError: row?.lastError,
      itemCount: row?.itemCount,
    });
  });
}

export async function triggerReviewsFeedSyncIfStale(
  restaurantId: string,
  platforms?: ReviewPlatform[],
): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;

  const cacheable = (platforms ?? [...REVIEWS_CACHEABLE_PLATFORMS]).filter(
    isReviewsCacheablePlatform,
  );
  if (cacheable.length === 0) return;

  const stale = await listStaleReviewsPlatforms(admin, restaurantId, cacheable);
  if (stale.length === 0) return;

  await syncRestaurantReviewsPlatforms(admin, restaurantId, stale);
}

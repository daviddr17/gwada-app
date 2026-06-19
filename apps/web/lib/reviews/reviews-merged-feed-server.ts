import "server-only";

import type { ReviewPlatform } from "@/lib/constants/review-platforms";
import {
  countGwadaReviews,
  loadGwadaReviewsForFeed,
} from "@/lib/reviews/reviews-gwada-feed-server";
import { paginateReviewList } from "@/lib/reviews/reviews-list-pagination";
import type { MergedReviewsPaginationMeta } from "@/lib/reviews/reviews-list-pagination";
import {
  readPlatformSyncMeta,
  readReviewsFeedFromCache,
} from "@/lib/reviews/reviews-feed-read-server";
import type { ReviewsFeedSyncMeta } from "@/lib/reviews/reviews-feed-sync-meta";
import { isReviewsPlatformConnected } from "@/lib/reviews/reviews-platform-connected-server";
import type { UnifiedReview } from "@/lib/reviews/unified-review";
import { compareFeedItemsWithPinFirst } from "@/lib/feed-pin/feed-pin-types";
import type { SupabaseClient } from "@supabase/supabase-js";

function sortReviewsByDateDesc(reviews: UnifiedReview[]): UnifiedReview[] {
  return [...reviews].sort((a, b) =>
    compareFeedItemsWithPinFirst(a, b, (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    ),
  );
}

export async function loadMergedReviewsFeedPage(params: {
  restaurantId: string;
  sb: SupabaseClient;
  pageToken: string | null;
}): Promise<{
  reviews: UnifiedReview[];
  pagination: MergedReviewsPaginationMeta;
  loadErrors: Partial<Record<ReviewPlatform, string>>;
  sync: ReviewsFeedSyncMeta;
}> {
  const { restaurantId, sb, pageToken } = params;

  const [gwadaReviews, gwadaTotal, googleConnected, facebookConnected, cachedFeed] =
    await Promise.all([
      loadGwadaReviewsForFeed(sb, restaurantId),
      countGwadaReviews(sb, restaurantId),
      isReviewsPlatformConnected(restaurantId, "google"),
      isReviewsPlatformConnected(restaurantId, "facebook"),
      readReviewsFeedFromCache(restaurantId, sb, ["google", "facebook"]),
    ]);

  const googleCached = googleConnected
    ? cachedFeed.reviews.filter((review) => review.platform === "google")
    : [];
  const facebookCached = facebookConnected
    ? cachedFeed.reviews.filter((review) => review.platform === "facebook")
    : [];

  const googleMeta = readPlatformSyncMeta(cachedFeed.syncRows, "google");
  const facebookMeta = readPlatformSyncMeta(cachedFeed.syncRows, "facebook");
  const facebookSync = cachedFeed.syncRows.find((row) => row.platform === "facebook");

  const platformTotals: Partial<Record<ReviewPlatform, number>> = {
    gwada: gwadaTotal,
  };
  if (googleConnected) {
    platformTotals.google =
      typeof googleMeta.totalReviewCount === "number"
        ? googleMeta.totalReviewCount
        : googleCached.length;
  }
  if (facebookConnected) {
    platformTotals.facebook =
      typeof facebookMeta.totalReviewCount === "number"
        ? facebookMeta.totalReviewCount
        : typeof facebookSync?.item_count === "number" && facebookSync.item_count > 0
          ? facebookSync.item_count
          : facebookCached.length;
  }

  const totalReviewCount = Object.values(platformTotals).reduce(
    (sum, count) => sum + count,
    0,
  );

  const merged = sortReviewsByDateDesc([
    ...gwadaReviews,
    ...googleCached,
    ...facebookCached,
  ]);

  const paginated = paginateReviewList(merged, pageToken, totalReviewCount);

  const loadErrors: Partial<Record<ReviewPlatform, string>> = {};
  if (cachedFeed.sync.platformErrors.google) {
    loadErrors.google = cachedFeed.sync.platformErrors.google;
  }
  if (cachedFeed.sync.platformErrors.facebook) {
    loadErrors.facebook = cachedFeed.sync.platformErrors.facebook;
  }

  return {
    reviews: paginated.reviews,
    pagination: {
      ...paginated.pagination,
      platformTotals,
    },
    loadErrors,
    sync: cachedFeed.sync,
  };
}

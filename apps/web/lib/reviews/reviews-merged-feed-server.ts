import "server-only";

import type { ReviewPlatform } from "@/lib/constants/review-platforms";
import {
  countGwadaReviews,
  loadGwadaReviewsForFeed,
} from "@/lib/reviews/reviews-gwada-feed-server";
import type { MergedReviewsPaginationMeta } from "@/lib/reviews/reviews-list-pagination";
import {
  readPlatformSyncMeta,
  readReviewsFeedFromCache,
} from "@/lib/reviews/reviews-feed-read-server";
import type { ReviewsFeedSyncMeta } from "@/lib/reviews/reviews-feed-sync-meta";
import {
  DEFAULT_REVIEWS_FEED_LIST_QUERY,
  paginateReviewsFeedList,
  type ReviewsFeedListQuery,
} from "@/lib/reviews/reviews-feed-list-query";
import { loadReviewPlatformConnectionState } from "@/lib/reviews/reviews-platform-connected-server";
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
  listQuery?: ReviewsFeedListQuery;
  /** Vor Filter (z. B. gelesen/ungelesen) die volle Liste anreichern. */
  enrichBeforeFilter?: (
    reviews: UnifiedReview[],
  ) => Promise<UnifiedReview[]>;
}): Promise<{
  reviews: UnifiedReview[];
  pagination: MergedReviewsPaginationMeta;
  loadErrors: Partial<Record<ReviewPlatform, string>>;
  sync: ReviewsFeedSyncMeta;
  /** True wenn Filter/Sort vor dem Slice angewendet wurden. */
  listQueryApplied: boolean;
}> {
  const {
    restaurantId,
    sb,
    pageToken,
    listQuery = DEFAULT_REVIEWS_FEED_LIST_QUERY,
    enrichBeforeFilter,
  } = params;

  const [gwadaReviews, gwadaTotal, platformState, cachedFeed] =
    await Promise.all([
      loadGwadaReviewsForFeed(sb, restaurantId),
      countGwadaReviews(sb, restaurantId),
      loadReviewPlatformConnectionState(restaurantId),
      readReviewsFeedFromCache(restaurantId, sb, [
        "google",
        "facebook",
        "tripadvisor",
      ]),
    ]);

  const { googleVisible, facebookVisible, tripadvisorVisible } = platformState;

  const googleCached = googleVisible
    ? cachedFeed.reviews.filter((review) => review.platform === "google")
    : [];
  const facebookCached = facebookVisible
    ? cachedFeed.reviews.filter((review) => review.platform === "facebook")
    : [];
  const tripadvisorCached = tripadvisorVisible
    ? cachedFeed.reviews.filter((review) => review.platform === "tripadvisor")
    : [];

  const googleMeta = readPlatformSyncMeta(cachedFeed.syncRows, "google");
  const facebookMeta = readPlatformSyncMeta(cachedFeed.syncRows, "facebook");
  const tripadvisorMeta = readPlatformSyncMeta(cachedFeed.syncRows, "tripadvisor");
  const facebookSync = cachedFeed.syncRows.find((row) => row.platform === "facebook");
  const tripadvisorSync = cachedFeed.syncRows.find(
    (row) => row.platform === "tripadvisor",
  );

  const platformTotals: Partial<Record<ReviewPlatform, number>> = {
    gwada: gwadaTotal,
  };
  if (googleVisible) {
    platformTotals.google =
      typeof googleMeta.totalReviewCount === "number"
        ? googleMeta.totalReviewCount
        : googleCached.length;
  }
  if (facebookVisible) {
    platformTotals.facebook =
      typeof facebookMeta.totalReviewCount === "number"
        ? facebookMeta.totalReviewCount
        : typeof facebookSync?.item_count === "number" && facebookSync.item_count > 0
          ? facebookSync.item_count
          : facebookCached.length;
  }
  if (tripadvisorVisible) {
    platformTotals.tripadvisor =
      typeof tripadvisorMeta.totalReviewCount === "number"
        ? tripadvisorMeta.totalReviewCount
        : typeof tripadvisorSync?.item_count === "number" &&
            tripadvisorSync.item_count > 0
          ? tripadvisorSync.item_count
          : tripadvisorCached.length;
  }

  const totalReviewCount = Object.values(platformTotals).reduce(
    (sum, count) => sum + count,
    0,
  );

  let merged = sortReviewsByDateDesc([
    ...gwadaReviews,
    ...googleCached,
    ...facebookCached,
    ...tripadvisorCached,
  ]);

  if (enrichBeforeFilter && listQuery.readFilter !== "all") {
    merged = await enrichBeforeFilter(merged);
  }

  const paginated = paginateReviewsFeedList(merged, pageToken, listQuery, {
    unfilteredTotalReviewCount: totalReviewCount,
  });

  const loadErrors: Partial<Record<ReviewPlatform, string>> = {};
  if (cachedFeed.sync.platformErrors.google) {
    loadErrors.google = cachedFeed.sync.platformErrors.google;
  }
  if (cachedFeed.sync.platformErrors.facebook) {
    loadErrors.facebook = cachedFeed.sync.platformErrors.facebook;
  }
  if (cachedFeed.sync.platformErrors.tripadvisor) {
    loadErrors.tripadvisor = cachedFeed.sync.platformErrors.tripadvisor;
  }

  return {
    reviews: paginated.reviews,
    pagination: {
      ...paginated.pagination,
      platformTotals,
    },
    loadErrors,
    sync: cachedFeed.sync,
    listQueryApplied: paginated.listQueryApplied,
  };
}

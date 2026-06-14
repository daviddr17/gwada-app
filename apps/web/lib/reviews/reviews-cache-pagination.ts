import "server-only";

import { GOOGLE_REVIEWS_PAGE_SIZE } from "@/lib/reviews/google-reviews-pagination";
import type { GoogleReviewsPaginationMeta } from "@/lib/reviews/google-reviews-pagination";
import type { ReviewsPlatformSyncMeta } from "@/lib/reviews/reviews-cache-db";
import {
  paginateReviewList,
  parseReviewListPageOffset,
} from "@/lib/reviews/reviews-list-pagination";
import type { UnifiedReview } from "@/lib/reviews/unified-review";

export function parseCachedGooglePageOffset(pageToken: string | null): number {
  return parseReviewListPageOffset(pageToken);
}

export function paginateCachedGoogleReviews(
  allReviews: UnifiedReview[],
  pageToken: string | null,
  meta: ReviewsPlatformSyncMeta,
  pageSize = GOOGLE_REVIEWS_PAGE_SIZE,
): {
  reviews: UnifiedReview[];
  pagination: GoogleReviewsPaginationMeta;
} {
  const { reviews, pagination } = paginateReviewList(
    allReviews,
    pageToken,
    meta.totalReviewCount ?? allReviews.length,
    pageSize,
    typeof meta.averageRating === "number" ? meta.averageRating : null,
  );

  return {
    reviews,
    pagination: {
      pageSize: pagination.pageSize,
      totalReviewCount: pagination.totalReviewCount,
      averageRating: pagination.averageRating ?? null,
      nextPageToken: pagination.nextPageToken,
    },
  };
}

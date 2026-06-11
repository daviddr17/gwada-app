import "server-only";

import { GOOGLE_REVIEWS_PAGE_SIZE } from "@/lib/reviews/google-reviews-pagination";
import type { GoogleReviewsPaginationMeta } from "@/lib/reviews/google-reviews-pagination";
import type { ReviewsPlatformSyncMeta } from "@/lib/reviews/reviews-cache-db";
import type { UnifiedReview } from "@/lib/reviews/unified-review";

const CACHE_PAGE_TOKEN_PREFIX = "cache:";

export function parseCachedGooglePageOffset(pageToken: string | null): number {
  if (!pageToken?.startsWith(CACHE_PAGE_TOKEN_PREFIX)) return 0;
  const offset = Number.parseInt(pageToken.slice(CACHE_PAGE_TOKEN_PREFIX.length), 10);
  return Number.isFinite(offset) && offset >= 0 ? offset : 0;
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
  const offset = parseCachedGooglePageOffset(pageToken);
  const reviews = allReviews.slice(offset, offset + pageSize);
  const nextOffset = offset + pageSize;
  const hasMore = nextOffset < allReviews.length;

  return {
    reviews,
    pagination: {
      pageSize,
      totalReviewCount: meta.totalReviewCount ?? allReviews.length,
      averageRating:
        typeof meta.averageRating === "number" ? meta.averageRating : null,
      nextPageToken: hasMore ? `${CACHE_PAGE_TOKEN_PREFIX}${nextOffset}` : null,
    },
  };
}

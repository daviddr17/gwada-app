import { GOOGLE_REVIEWS_PAGE_SIZE } from "@/lib/reviews/google-reviews-pagination";
import type { ReviewPlatform } from "@/lib/constants/review-platforms";
import type { UnifiedReview } from "@/lib/reviews/unified-review";

const PAGE_TOKEN_PREFIX = "cache:";

export type ReviewListPaginationMeta = {
  pageSize: number;
  totalReviewCount: number;
  nextPageToken: string | null;
  averageRating?: number | null;
};

export type MergedReviewsPaginationMeta = ReviewListPaginationMeta & {
  platformTotals: Partial<Record<ReviewPlatform, number>>;
};

export function parseReviewListPageOffset(pageToken: string | null): number {
  if (!pageToken?.startsWith(PAGE_TOKEN_PREFIX)) return 0;
  const offset = Number.parseInt(pageToken.slice(PAGE_TOKEN_PREFIX.length), 10);
  return Number.isFinite(offset) && offset >= 0 ? offset : 0;
}

export function paginateReviewList(
  allReviews: UnifiedReview[],
  pageToken: string | null,
  totalReviewCount: number,
  pageSize = GOOGLE_REVIEWS_PAGE_SIZE,
  averageRating: number | null = null,
): {
  reviews: UnifiedReview[];
  pagination: ReviewListPaginationMeta;
} {
  const offset = parseReviewListPageOffset(pageToken);
  const reviews = allReviews.slice(offset, offset + pageSize);
  const nextOffset = offset + pageSize;
  const hasMore = nextOffset < allReviews.length;

  return {
    reviews,
    pagination: {
      pageSize,
      totalReviewCount,
      averageRating,
      nextPageToken: hasMore ? `${PAGE_TOKEN_PREFIX}${nextOffset}` : null,
    },
  };
}

export function reviewListTotalPages(
  totalReviewCount: number,
  pageSize = GOOGLE_REVIEWS_PAGE_SIZE,
): number {
  if (totalReviewCount <= 0) return 1;
  return Math.ceil(totalReviewCount / pageSize);
}

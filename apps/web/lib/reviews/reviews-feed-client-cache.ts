import type { ReviewPlatform } from "@/lib/constants/review-platforms";
import type { ReviewsFeedSyncMeta } from "@/lib/reviews/reviews-feed-sync-meta";
import type { GoogleReviewsPaginationMeta } from "@/lib/reviews/google-reviews-pagination";
import type {
  MergedReviewsPaginationMeta,
  ReviewListPaginationMeta,
} from "@/lib/reviews/reviews-list-pagination";
import type { ReviewRatingSummary } from "@/lib/reviews/review-stats";
import type { UnifiedReview } from "@/lib/reviews/unified-review";

export type ReviewsFeedPageMap = Record<number, UnifiedReview[]>;

export type ReviewsFeedClientCache = {
  ready: boolean;
  gwada: UnifiedReview[];
  gwadaSummary: ReviewRatingSummary | null;
  allPages: ReviewsFeedPageMap;
  allPagination: MergedReviewsPaginationMeta | null;
  allSummary: ReviewRatingSummary | null;
  allTokenByPage: Record<number, string>;
  googlePages: ReviewsFeedPageMap;
  googlePagination: GoogleReviewsPaginationMeta | null;
  googleSummary: ReviewRatingSummary | null;
  googleTokenByPage: Record<number, string>;
  facebookPages: ReviewsFeedPageMap;
  facebookPagination: ReviewListPaginationMeta | null;
  facebookSummary: ReviewRatingSummary | null;
  facebookTokenByPage: Record<number, string>;
  tripadvisorPages: ReviewsFeedPageMap;
  tripadvisorPagination: ReviewListPaginationMeta | null;
  tripadvisorSummary: ReviewRatingSummary | null;
  tripadvisorTokenByPage: Record<number, string>;
  platformTotals: Partial<Record<ReviewPlatform, number>>;
  loadErrors: Partial<Record<ReviewPlatform, string>>;
  sync: ReviewsFeedSyncMeta | null;
};

export function createEmptyReviewsFeedClientCache(): ReviewsFeedClientCache {
  return {
    ready: false,
    gwada: [],
    gwadaSummary: null,
    allPages: {},
    allPagination: null,
    allSummary: null,
    allTokenByPage: {},
    googlePages: {},
    googlePagination: null,
    googleSummary: null,
    googleTokenByPage: {},
    facebookPages: {},
    facebookPagination: null,
    facebookSummary: null,
    facebookTokenByPage: {},
    tripadvisorPages: {},
    tripadvisorPagination: null,
    tripadvisorSummary: null,
    tripadvisorTokenByPage: {},
    platformTotals: {},
    loadErrors: {},
    sync: null,
  };
}

export function patchReviewInFeedCache(
  cache: ReviewsFeedClientCache,
  review: UnifiedReview,
  patch: Partial<UnifiedReview>,
): ReviewsFeedClientCache {
  const key = `${review.platform}:${review.id}`;
  const patchList = (items: UnifiedReview[]) =>
    items.map((item) =>
      `${item.platform}:${item.id}` === key ? { ...item, ...patch } : item,
    );
  const patchPages = (pages: ReviewsFeedPageMap) => {
    const next: ReviewsFeedPageMap = {};
    for (const [page, items] of Object.entries(pages)) {
      next[Number(page)] = patchList(items);
    }
    return next;
  };

  return {
    ...cache,
    gwada: review.platform === "gwada" ? patchList(cache.gwada) : cache.gwada,
    allPages: patchPages(cache.allPages),
    googlePages: patchPages(cache.googlePages),
    facebookPages: patchPages(cache.facebookPages),
    tripadvisorPages: patchPages(cache.tripadvisorPages),
  };
}

export function markReviewsReadInFeedCache(
  cache: ReviewsFeedClientCache,
  reviews: UnifiedReview[],
): ReviewsFeedClientCache {
  if (reviews.length === 0) return cache;
  let next = cache;
  for (const review of reviews) {
    next = patchReviewInFeedCache(next, review, { isUnread: false });
  }
  return next;
}

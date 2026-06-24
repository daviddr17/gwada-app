import type { ReviewPlatform } from "@/lib/constants/review-platforms";
import type { ReviewsFeedSyncMeta } from "@/lib/reviews/reviews-feed-sync-meta";
import type { GoogleReviewsPaginationMeta } from "@/lib/reviews/google-reviews-pagination";
import type {
  MergedReviewsPaginationMeta,
  ReviewListPaginationMeta,
} from "@/lib/reviews/reviews-list-pagination";
import type { UnifiedReview } from "@/lib/reviews/unified-review";

export type ReviewsFeedPageMap = Record<number, UnifiedReview[]>;

export type ReviewsFeedClientCache = {
  ready: boolean;
  gwada: UnifiedReview[];
  allPages: ReviewsFeedPageMap;
  allPagination: MergedReviewsPaginationMeta | null;
  allTokenByPage: Record<number, string>;
  googlePages: ReviewsFeedPageMap;
  googlePagination: GoogleReviewsPaginationMeta | null;
  googleTokenByPage: Record<number, string>;
  facebookPages: ReviewsFeedPageMap;
  facebookPagination: ReviewListPaginationMeta | null;
  facebookTokenByPage: Record<number, string>;
  platformTotals: Partial<Record<ReviewPlatform, number>>;
  loadErrors: Partial<Record<ReviewPlatform, string>>;
  sync: ReviewsFeedSyncMeta | null;
};

export function createEmptyReviewsFeedClientCache(): ReviewsFeedClientCache {
  return {
    ready: false,
    gwada: [],
    allPages: {},
    allPagination: null,
    allTokenByPage: {},
    googlePages: {},
    googlePagination: null,
    googleTokenByPage: {},
    facebookPages: {},
    facebookPagination: null,
    facebookTokenByPage: {},
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

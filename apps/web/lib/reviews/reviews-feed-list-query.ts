import { compareFeedItemsWithPinFirst } from "@/lib/feed-pin/feed-pin-types";
import {
  filterReviews,
  hasActiveReviewFilters,
  sortReviews,
  type ReviewCommentFilter,
  type ReviewRatingFilter,
  type ReviewReplyFilter,
  type ReviewSortKey,
} from "@/lib/reviews/filter-sort-reviews";
import { paginateReviewList } from "@/lib/reviews/reviews-list-pagination";
import type { ReviewListPaginationMeta } from "@/lib/reviews/reviews-list-pagination";
import type { ReviewReadFilter } from "@/lib/reviews/review-read-state";
import type { UnifiedReview } from "@/lib/reviews/unified-review";

export type ReviewsFeedListQuery = {
  search: string;
  ratingFilter: ReviewRatingFilter;
  commentFilter: ReviewCommentFilter;
  replyFilter: ReviewReplyFilter;
  readFilter: ReviewReadFilter;
  sortKey: ReviewSortKey;
  showReplyFilter: boolean;
};

const RATING_FILTERS = new Set<ReviewRatingFilter>([
  "all",
  "1",
  "2",
  "3",
  "4",
  "5",
]);
const COMMENT_FILTERS = new Set<ReviewCommentFilter>(["all", "with", "without"]);
const REPLY_FILTERS = new Set<ReviewReplyFilter>(["all", "answered", "open"]);
const READ_FILTERS = new Set<ReviewReadFilter>(["all", "unread", "read"]);
const SORT_KEYS = new Set<ReviewSortKey>([
  "created_desc",
  "created_asc",
  "rating_desc",
  "rating_asc",
  "author_asc",
]);

export const DEFAULT_REVIEWS_FEED_LIST_QUERY: ReviewsFeedListQuery = {
  search: "",
  ratingFilter: "all",
  commentFilter: "all",
  replyFilter: "all",
  readFilter: "all",
  sortKey: "created_desc",
  showReplyFilter: true,
};

export function parseReviewsFeedListQuery(
  searchParams: URLSearchParams,
  options?: { showReplyFilter?: boolean },
): ReviewsFeedListQuery {
  const ratingRaw = searchParams.get("rating")?.trim() ?? "all";
  const commentRaw = searchParams.get("comment")?.trim() ?? "all";
  const replyRaw = searchParams.get("reply")?.trim() ?? "all";
  const readRaw = searchParams.get("read")?.trim() ?? "all";
  const sortRaw = searchParams.get("sort")?.trim() ?? "created_desc";

  return {
    search: searchParams.get("q")?.trim() ?? "",
    ratingFilter: RATING_FILTERS.has(ratingRaw as ReviewRatingFilter)
      ? (ratingRaw as ReviewRatingFilter)
      : "all",
    commentFilter: COMMENT_FILTERS.has(commentRaw as ReviewCommentFilter)
      ? (commentRaw as ReviewCommentFilter)
      : "all",
    replyFilter: REPLY_FILTERS.has(replyRaw as ReviewReplyFilter)
      ? (replyRaw as ReviewReplyFilter)
      : "all",
    readFilter: READ_FILTERS.has(readRaw as ReviewReadFilter)
      ? (readRaw as ReviewReadFilter)
      : "all",
    sortKey: SORT_KEYS.has(sortRaw as ReviewSortKey)
      ? (sortRaw as ReviewSortKey)
      : "created_desc",
    showReplyFilter: options?.showReplyFilter ?? true,
  };
}

/** Filter/Sort weichen vom Default ab → volle Liste vor Paginierung nötig. */
export function reviewsFeedListQueryNeedsFullPass(
  query: ReviewsFeedListQuery,
): boolean {
  if (query.sortKey !== "created_desc") return true;
  return hasActiveReviewFilters({
    search: query.search,
    ratingFilter: query.ratingFilter,
    commentFilter: query.commentFilter,
    replyFilter: query.replyFilter,
    showReplyFilter: query.showReplyFilter,
    readFilter: query.readFilter,
  });
}

export function reviewsFeedListQueryKey(query: ReviewsFeedListQuery): string {
  return [
    query.search.trim(),
    query.ratingFilter,
    query.commentFilter,
    query.showReplyFilter ? query.replyFilter : "all",
    query.readFilter,
    query.sortKey,
  ].join("|");
}

export function appendReviewsFeedListQueryParams(
  params: URLSearchParams,
  query: Omit<ReviewsFeedListQuery, "showReplyFilter"> & {
    showReplyFilter?: boolean;
  },
): void {
  const q = query.search.trim();
  if (q) params.set("q", q);
  if (query.ratingFilter !== "all") params.set("rating", query.ratingFilter);
  if (query.commentFilter !== "all") params.set("comment", query.commentFilter);
  if (query.showReplyFilter !== false && query.replyFilter !== "all") {
    params.set("reply", query.replyFilter);
  }
  if (query.readFilter !== "all") params.set("read", query.readFilter);
  if (query.sortKey !== "created_desc") params.set("sort", query.sortKey);
}

export function applyReviewsFeedListQuery(
  reviews: UnifiedReview[],
  query: ReviewsFeedListQuery,
): UnifiedReview[] {
  const filtered = filterReviews(reviews, {
    search: query.search,
    ratingFilter: query.ratingFilter,
    commentFilter: query.commentFilter,
    replyFilter: query.replyFilter,
    showReplyFilter: query.showReplyFilter,
    readFilter: query.readFilter,
  });

  if (query.sortKey === "created_desc") {
    return [...filtered].sort((a, b) =>
      compareFeedItemsWithPinFirst(
        a,
        b,
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      ),
    );
  }

  if (query.sortKey === "created_asc") {
    return [...filtered].sort((a, b) =>
      compareFeedItemsWithPinFirst(
        a,
        b,
        (left, right) =>
          new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
      ),
    );
  }

  return sortReviews(filtered, query.sortKey);
}

export function paginateReviewsFeedList(
  reviews: UnifiedReview[],
  pageToken: string | null,
  query: ReviewsFeedListQuery,
  options?: {
    /** Nur ohne Filter/Sort-Override: z. B. Google-Gesamtzahl. */
    unfilteredTotalReviewCount?: number;
    averageRating?: number | null;
  },
): {
  reviews: UnifiedReview[];
  pagination: ReviewListPaginationMeta;
  listQueryApplied: boolean;
} {
  const needsFullPass = reviewsFeedListQueryNeedsFullPass(query);
  if (!needsFullPass) {
    const total =
      typeof options?.unfilteredTotalReviewCount === "number"
        ? options.unfilteredTotalReviewCount
        : reviews.length;
    const paginated = paginateReviewList(
      reviews,
      pageToken,
      total,
      undefined,
      options?.averageRating ?? null,
    );
    return { ...paginated, listQueryApplied: false };
  }

  const prepared = applyReviewsFeedListQuery(reviews, query);
  const paginated = paginateReviewList(
    prepared,
    pageToken,
    prepared.length,
    undefined,
    options?.averageRating ?? null,
  );
  return { ...paginated, listQueryApplied: true };
}

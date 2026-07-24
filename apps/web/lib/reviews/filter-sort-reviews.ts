import type { ReviewPlatformFilter } from "@/lib/constants/review-platforms";
import { REVIEW_FILTER_ALL } from "@/lib/constants/review-platforms";
import type { ReviewReadFilter } from "@/lib/reviews/review-read-state";
import type { UnifiedReview } from "@/lib/reviews/unified-review";

export type ReviewSortKey =
  | "created_desc"
  | "created_asc"
  | "rating_desc"
  | "rating_asc";

export type ReviewRatingFilter = "all" | "1" | "2" | "3" | "4" | "5";

export type ReviewReplyFilter = "all" | "answered" | "open";

export type ReviewCommentFilter = "all" | "with" | "without";

export const REVIEW_SORT_OPTIONS: { value: ReviewSortKey; label: string }[] = [
  { value: "created_desc", label: "Datum: neueste zuerst" },
  { value: "created_asc", label: "Datum: älteste zuerst" },
  { value: "rating_desc", label: "Sterne: beste zuerst" },
  { value: "rating_asc", label: "Sterne: niedrigste zuerst" },
];

export function reviewSortOptionLabel(key: ReviewSortKey): string {
  return (
    REVIEW_SORT_OPTIONS.find((o) => o.value === key)?.label ?? "Sortieren"
  );
}

export const REVIEW_RATING_FILTER_OPTIONS: {
  value: ReviewRatingFilter;
  label: string;
}[] = [
  { value: "all", label: "Alle Sterne" },
  { value: "5", label: "5 Sterne" },
  { value: "4", label: "4 Sterne" },
  { value: "3", label: "3 Sterne" },
  { value: "2", label: "2 Sterne" },
  { value: "1", label: "1 Stern" },
];

export const REVIEW_COMMENT_FILTER_OPTIONS: {
  value: ReviewCommentFilter;
  label: string;
}[] = [
  { value: "all", label: "Alle Kommentare" },
  { value: "with", label: "Mit Kommentar" },
  { value: "without", label: "Ohne Kommentar" },
];

export const REVIEW_REPLY_FILTER_OPTIONS: {
  value: ReviewReplyFilter;
  label: string;
}[] = [
  { value: "all", label: "Alle Antworten" },
  { value: "answered", label: "Beantwortet" },
  { value: "open", label: "Offen (antwortbar)" },
];

export function filterReviewsByPlatform(
  reviews: UnifiedReview[],
  platformFilter: ReviewPlatformFilter,
): UnifiedReview[] {
  if (platformFilter === REVIEW_FILTER_ALL) return reviews;
  return reviews.filter((review) => review.platform === platformFilter);
}

export function reviewMatchesSearch(review: UnifiedReview, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const parts = [
    review.comment ?? "",
    review.authorName ?? "",
    review.reply ?? "",
  ];
  return parts.some((p) => p.toLowerCase().includes(q));
}

export function filterReviews(
  reviews: UnifiedReview[],
  params: {
    search: string;
    ratingFilter: ReviewRatingFilter;
    commentFilter: ReviewCommentFilter;
    replyFilter: ReviewReplyFilter;
    showReplyFilter: boolean;
    readFilter?: ReviewReadFilter;
  },
): UnifiedReview[] {
  return reviews.filter((review) => {
    if (!reviewMatchesSearch(review, params.search)) return false;

    if (params.readFilter === "unread" && review.isUnread === false) return false;
    if (params.readFilter === "read" && review.isUnread !== false) return false;

    if (params.ratingFilter !== "all") {
      const target = Number(params.ratingFilter);
      if (Math.round(review.rating) !== target) return false;
    }

    if (params.commentFilter === "with" && !review.comment?.trim()) return false;
    if (params.commentFilter === "without" && review.comment?.trim()) return false;

    if (params.showReplyFilter && params.replyFilter !== "all") {
      if (params.replyFilter === "answered" && !review.reply?.trim()) return false;
      if (params.replyFilter === "open" && (!review.canReply || review.reply?.trim())) {
        return false;
      }
    }

    return true;
  });
}

type ReviewSortable = Pick<UnifiedReview, "rating" | "createdAt" | "authorName">;

export function sortReviews<T extends ReviewSortable>(
  reviews: T[],
  sortKey: ReviewSortKey,
): T[] {
  const sorted = [...reviews];
  sorted.sort((a, b) => {
    switch (sortKey) {
      case "created_desc":
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      case "created_asc":
        return (
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      case "rating_desc":
        return b.rating - a.rating || compareCreatedDesc(a, b);
      case "rating_asc":
        return a.rating - b.rating || compareCreatedDesc(a, b);
      default:
        return 0;
    }
  });
  return sorted;
}

function compareCreatedDesc(a: ReviewSortable, b: ReviewSortable): number {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

export function hasActiveReviewFilters(params: {
  search: string;
  ratingFilter: ReviewRatingFilter;
  commentFilter: ReviewCommentFilter;
  replyFilter: ReviewReplyFilter;
  showReplyFilter: boolean;
  readFilter?: ReviewReadFilter;
}): boolean {
  if (params.search.trim()) return true;
  if (params.readFilter && params.readFilter !== "all") return true;
  if (params.ratingFilter !== "all") return true;
  if (params.commentFilter !== "all") return true;
  if (params.showReplyFilter && params.replyFilter !== "all") return true;
  return false;
}

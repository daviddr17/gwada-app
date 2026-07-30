"use client";

import { useEffect, useMemo, useState } from "react";
import { ReviewPlatformChip } from "@/components/reviews/review-platform-chip";
import { ReviewPlatformIcon } from "@/components/reviews/review-platform-icon";
import { PublicReviewsTimelineView } from "@/components/reviews/reviews-public-timeline";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ListPaginationSurround } from "@/components/ui/list-pagination";
import {
  REVIEW_PLATFORM_LABELS,
  type ReviewPlatform,
} from "@/lib/constants/review-platforms";
import { paginateListItems } from "@/lib/constants/list-pagination";
import {
  REVIEW_SORT_OPTIONS,
  reviewSortOptionLabel,
  sortReviews,
  type ReviewSortKey,
} from "@/lib/reviews/filter-sort-reviews";
import type { PublicEmbedReview } from "@/lib/reviews/public-reviews-server";
import { PUBLIC_EMBED_REVIEWS_PAGE_SIZE } from "@/lib/reviews/public-embed-reviews-pagination";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { cn } from "@/lib/utils";

const reviewsSortSelectClass = appSelectTriggerAccentCn(
  "h-auto min-h-0 w-full rounded-full px-3 py-1.5 text-sm font-medium leading-none sm:w-auto sm:min-w-[11rem] [&_[data-slot=select-value]]:truncate",
);

export function RestaurantPublicProfileReviews({
  reviews,
  connectedPlatforms,
}: {
  reviews: PublicEmbedReview[];
  connectedPlatforms: ReviewPlatform[];
}) {
  const [platformFilter, setPlatformFilter] = useState<ReviewPlatform | "all">(
    "all",
  );
  const [sortKey, setSortKey] = useState<ReviewSortKey>("created_desc");
  const [page, setPage] = useState(1);

  const filteredSorted = useMemo(() => {
    const filtered =
      platformFilter === "all"
        ? reviews
        : reviews.filter((r) => r.platform === platformFilter);
    return sortReviews(filtered, sortKey);
  }, [platformFilter, reviews, sortKey]);

  useEffect(() => {
    setPage(1);
  }, [platformFilter, sortKey]);

  const pagination = useMemo(
    () =>
      paginateListItems(
        filteredSorted,
        page,
        PUBLIC_EMBED_REVIEWS_PAGE_SIZE,
      ),
    [filteredSorted, page],
  );

  const showPagination =
    pagination.totalPages > 1 || pagination.totalCount > 0;

  const reviewList = (
    <PublicReviewsTimelineView reviews={pagination.items} />
  );

  const showPlatformChips = connectedPlatforms.length > 1;

  return (
    <div className="px-0 py-0">
      <div className="flex flex-col gap-3">
        {showPlatformChips ? (
          <div className="flex flex-wrap gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => setPlatformFilter("all")}
              className={cn(
                "inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                platformFilter === "all"
                  ? "border-accent/50 bg-accent/15 text-foreground"
                  : "border-border/60 bg-card text-muted-foreground hover:border-border hover:text-foreground",
              )}
              aria-pressed={platformFilter === "all"}
            >
              Alle
            </button>
            {connectedPlatforms.map((platform) => (
              <ReviewPlatformChip
                key={platform}
                platform={platform}
                selected={platformFilter === platform}
                onSelect={() =>
                  setPlatformFilter((current) =>
                    current === platform ? "all" : platform,
                  )
                }
              />
            ))}
          </div>
        ) : connectedPlatforms.length === 1 ? (
          <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <ReviewPlatformIcon platform={connectedPlatforms[0]!} className="size-3.5" />
            {REVIEW_PLATFORM_LABELS[connectedPlatforms[0]!]}
          </p>
        ) : null}

        <Select
          value={sortKey}
          onValueChange={(value) => setSortKey(value as ReviewSortKey)}
        >
          <SelectTrigger className={reviewsSortSelectClass} aria-label="Sortieren">
            <SelectValue>{reviewSortOptionLabel(sortKey)}</SelectValue>
          </SelectTrigger>
          <SelectContent align="start">
            {REVIEW_SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <section className="mt-4">
        {filteredSorted.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {reviews.length === 0
              ? "Noch keine Bewertungen."
              : "Keine Bewertungen für diesen Filter."}
          </p>
        ) : showPagination ? (
          <ListPaginationSurround
            classNameAbove="mb-4 border-b-0 pb-0"
            classNameBelow="mt-4 border-t-0 pt-0"
            page={pagination.page}
            totalPages={pagination.totalPages}
            shown={pagination.items.length}
            totalCount={pagination.totalCount}
            itemLabel="Bewertungen"
            canPrevious={pagination.page > 1}
            canNext={pagination.page < pagination.totalPages}
            onPrevious={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() =>
              setPage((p) => Math.min(pagination.totalPages, p + 1))
            }
          >
            {reviewList}
          </ListPaginationSurround>
        ) : (
          reviewList
        )}
      </section>
    </div>
  );
}

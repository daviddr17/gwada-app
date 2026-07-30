"use client";

import { toast } from "sonner";
import { DrawerFilterFooter } from "@/components/ui/drawer-filter-footer";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName } from "@/lib/ui/drawer-form-section";
import { SearchableSelect } from "@/components/ui/combobox";
import {
  Drawer,
  DrawerContent,
} from "@/components/ui/drawer";
import {
  DrawerFilterField,
  DrawerFilterHeader,
  DrawerFilterZone,
  DrawerSortZone,
} from "@/components/ui/drawer-filter-sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { staffDrawerFieldClassName } from "@/components/staff/staff-form-field-styles";
import {
  REVIEW_COMMENT_FILTER_OPTIONS,
  REVIEW_RATING_FILTER_OPTIONS,
  REVIEW_REPLY_FILTER_OPTIONS,
  REVIEW_SORT_OPTIONS,
  reviewSortOptionLabel,
  type ReviewCommentFilter,
  type ReviewRatingFilter,
  type ReviewReplyFilter,
  type ReviewSortKey,
} from "@/lib/reviews/filter-sort-reviews";
import { REVIEW_READ_FILTER_OPTIONS } from "@/lib/reviews/review-read-state";
import type { ReviewReadFilter } from "@/lib/reviews/review-read-state";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { cn } from "@/lib/utils";

const reviewsFilterSelectClassName = appSelectTriggerAccentCn(
  staffDrawerFieldClassName,
);

const reviewsSortSelectClassName = appSelectTriggerAccentCn(
  cn(staffDrawerFieldClassName, "w-full"),
);

type ReviewsFilterDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  readFilter: ReviewReadFilter;
  onReadFilterChange: (value: ReviewReadFilter) => void;
  ratingFilter: ReviewRatingFilter;
  onRatingFilterChange: (value: ReviewRatingFilter) => void;
  commentFilter: ReviewCommentFilter;
  onCommentFilterChange: (value: ReviewCommentFilter) => void;
  replyFilter: ReviewReplyFilter;
  onReplyFilterChange: (value: ReviewReplyFilter) => void;
  showReplyFilter: boolean;
  sortKey: ReviewSortKey;
  onSortKeyChange: (value: ReviewSortKey) => void;
};

export function countReviewsDrawerActiveFilters(input: {
  readFilter: ReviewReadFilter;
  ratingFilter: ReviewRatingFilter;
  commentFilter: ReviewCommentFilter;
  replyFilter: ReviewReplyFilter;
  showReplyFilter: boolean;
  sortKey: ReviewSortKey;
}): number {
  let n = 0;
  if (input.readFilter !== "all") n += 1;
  if (input.ratingFilter !== "all") n += 1;
  if (input.commentFilter !== "all") n += 1;
  if (input.showReplyFilter && input.replyFilter !== "all") n += 1;
  if (input.sortKey !== "created_desc") n += 1;
  return n;
}

export function ReviewsFilterDrawer({
  open,
  onOpenChange,
  readFilter,
  onReadFilterChange,
  ratingFilter,
  onRatingFilterChange,
  commentFilter,
  onCommentFilterChange,
  replyFilter,
  onReplyFilterChange,
  showReplyFilter,
  sortKey,
  onSortKeyChange,
}: ReviewsFilterDrawerProps) {
  const resetFilters = () => {
    onReadFilterChange("all");
    onRatingFilterChange("all");
    onCommentFilterChange("all");
    onReplyFilterChange("all");
    onSortKeyChange("created_desc");
    toast.success("Filter zurückgesetzt");
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent className={drawerContentClassName("filter")}>
        <DrawerFilterHeader title="Filter & Sortierung" />

        <div className={drawerScrollAreaClassName(6)}>
          <DrawerFilterZone>
            <DrawerFilterField label="Gelesen">
              <SearchableSelect
                options={REVIEW_READ_FILTER_OPTIONS}
                value={readFilter}
                onValueChange={(v) => onReadFilterChange(v as ReviewReadFilter)}
                placeholder="Alle"
                searchPlaceholder="Gelesen …"
                aria-label="Nach Gelesen-Status filtern"
                className={reviewsFilterSelectClassName}
              />
            </DrawerFilterField>

            <DrawerFilterField label="Sterne">
              <SearchableSelect
                options={REVIEW_RATING_FILTER_OPTIONS}
                value={ratingFilter}
                onValueChange={(v) =>
                  onRatingFilterChange(v as ReviewRatingFilter)
                }
                placeholder="Alle Sterne"
                searchPlaceholder="Sterne …"
                aria-label="Nach Sternen filtern"
                className={reviewsFilterSelectClassName}
              />
            </DrawerFilterField>

            <DrawerFilterField label="Kommentar">
              <SearchableSelect
                options={REVIEW_COMMENT_FILTER_OPTIONS}
                value={commentFilter}
                onValueChange={(v) =>
                  onCommentFilterChange(v as ReviewCommentFilter)
                }
                placeholder="Alle Kommentare"
                searchPlaceholder="Kommentar …"
                aria-label="Nach Kommentar filtern"
                className={reviewsFilterSelectClassName}
              />
            </DrawerFilterField>

            {showReplyFilter ? (
              <DrawerFilterField label="Antwort">
                <SearchableSelect
                  options={REVIEW_REPLY_FILTER_OPTIONS}
                  value={replyFilter}
                  onValueChange={(v) =>
                    onReplyFilterChange(v as ReviewReplyFilter)
                  }
                  placeholder="Alle Antworten"
                  searchPlaceholder="Antwort …"
                  aria-label="Nach Antwortstatus filtern"
                  className={reviewsFilterSelectClassName}
                />
              </DrawerFilterField>
            ) : null}
          </DrawerFilterZone>

          <DrawerSortZone>
            <Select
              value={sortKey}
              onValueChange={(v) => onSortKeyChange(v as ReviewSortKey)}
            >
              <SelectTrigger
                className={reviewsSortSelectClassName}
                aria-label="Sortierung"
              >
                <SelectValue placeholder="Sortieren">
                  {reviewSortOptionLabel(sortKey)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {REVIEW_SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </DrawerSortZone>
        </div>
        <DrawerFilterFooter onReset={resetFilters} onDone={() => onOpenChange(false)} />
      </DrawerContent>
    </Drawer>
  );
}

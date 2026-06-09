"use client";

import { toast } from "sonner";
import { SearchableSelect } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
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
      <DrawerContent className="mx-auto flex max-h-[min(92dvh,560px)] max-w-lg flex-col overflow-hidden rounded-t-[1.75rem] border-0 bg-card shadow-elevated">
        <DrawerHeader className="shrink-0 px-6 pt-2 pb-2 text-left">
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Filter & Sortierung
          </DrawerTitle>
          <DrawerDescription className="text-base">
            Bewertungen nach Status, Sternen und Kommentar eingrenzen sowie
            sortieren.
          </DrawerDescription>
        </DrawerHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overflow-x-hidden overscroll-contain px-6 pb-2">
          <div className="space-y-3">
            <Label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Gelesen
            </Label>
            <SearchableSelect
              options={REVIEW_READ_FILTER_OPTIONS}
              value={readFilter}
              onValueChange={(v) => onReadFilterChange(v as ReviewReadFilter)}
              placeholder="Alle"
              searchPlaceholder="Status …"
              aria-label="Nach Gelesen-Status filtern"
              className={reviewsFilterSelectClassName}
            />
          </div>

          <div className="space-y-3">
            <Label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Sterne
            </Label>
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
          </div>

          <div className="space-y-3">
            <Label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Kommentar
            </Label>
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
          </div>

          {showReplyFilter ? (
            <div className="space-y-3">
              <Label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Antwort
              </Label>
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
            </div>
          ) : null}

          <Separator />

          <div className="space-y-3">
            <Label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Sortierung
            </Label>
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
          </div>
        </div>

        <Separator />

        <div className="flex gap-3 px-6 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <Button
            type="button"
            variant="outline"
            className="h-12 flex-1 rounded-xl tap-scale"
            onClick={resetFilters}
          >
            Zurücksetzen
          </Button>
          <Button
            type="button"
            className={cn("h-12 flex-1", brandActionButtonRoundedClassName)}
            onClick={() => onOpenChange(false)}
          >
            Fertig
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

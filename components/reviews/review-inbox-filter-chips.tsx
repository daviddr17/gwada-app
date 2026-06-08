"use client";

import { LayoutGrid } from "lucide-react";
import { ReviewPlatformChip } from "@/components/reviews/review-platform-chip";
import {
  REVIEW_FILTER_ALL,
  REVIEW_FILTER_LABELS,
  REVIEW_PLATFORM_ORDER,
  type ReviewPlatform,
  type ReviewPlatformFilter,
} from "@/lib/constants/review-platforms";
import { cn } from "@/lib/utils";

export function ReviewInboxFilterChips({
  filter,
  onFilterChange,
  isPlatformAvailable,
  disabled,
}: {
  filter: ReviewPlatformFilter;
  onFilterChange: (filter: ReviewPlatformFilter) => void;
  isPlatformAvailable: (p: ReviewPlatform) => boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onFilterChange(REVIEW_FILTER_ALL)}
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
          filter === REVIEW_FILTER_ALL
            ? "border-accent/50 bg-accent/15 text-foreground"
            : "border-border/60 bg-card text-muted-foreground hover:border-border hover:text-foreground",
          disabled && "pointer-events-none opacity-50",
        )}
        aria-pressed={filter === REVIEW_FILTER_ALL}
      >
        <LayoutGrid className="size-4" aria-hidden />
        {REVIEW_FILTER_LABELS.all}
      </button>
      {REVIEW_PLATFORM_ORDER.map((p) => (
        <ReviewPlatformChip
          key={p}
          platform={p}
          selected={filter === p}
          onSelect={() => onFilterChange(p)}
          disabled={disabled || !isPlatformAvailable(p)}
        />
      ))}
    </div>
  );
}

"use client";

import type { ReviewReadFilter } from "@/lib/reviews/review-read-state";
import { REVIEW_READ_FILTER_OPTIONS } from "@/lib/reviews/review-read-state";
import { cn } from "@/lib/utils";

export function ReviewReadFilterChips({
  value,
  onChange,
  disabled,
  unreadTotal,
}: {
  value: ReviewReadFilter;
  onChange: (value: ReviewReadFilter) => void;
  disabled?: boolean;
  unreadTotal?: number;
}) {
  return (
    <div
      className="flex flex-wrap gap-1.5"
      role="group"
      aria-label="Gelesen-Filter"
    >
      {REVIEW_READ_FILTER_OPTIONS.map((opt) => {
        const selected = value === opt.value;
        const showBadge =
          opt.value === "unread" &&
          typeof unreadTotal === "number" &&
          unreadTotal > 0;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
              selected
                ? "border-accent/40 bg-accent/15 text-accent"
                : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground",
              disabled && "pointer-events-none opacity-50",
            )}
          >
            {opt.label}
            {showBadge ? (
              <span
                className={cn(
                  "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                  selected
                    ? "bg-accent text-accent-foreground"
                    : "bg-accent/20 text-accent",
                )}
              >
                {unreadTotal > 99 ? "99+" : unreadTotal}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

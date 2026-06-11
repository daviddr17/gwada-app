"use client";

import { LayoutGrid } from "lucide-react";
import { NewsPlatformIcon } from "@/components/news/news-platform-icon";
import {
  NEWS_FILTER_ALL,
  NEWS_FILTER_LABELS,
  NEWS_PLATFORM_LABELS,
  NEWS_PLATFORM_ORDER,
  type NewsPlatform,
  type NewsPlatformFilter,
} from "@/lib/constants/news-platforms";
import { cn } from "@/lib/utils";

export function NewsPlatformFilterChips({
  value,
  onChange,
  availablePlatforms,
  disabled,
}: {
  value: NewsPlatformFilter;
  onChange: (next: NewsPlatformFilter) => void;
  availablePlatforms: Set<string>;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(NEWS_FILTER_ALL)}
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
          value === NEWS_FILTER_ALL
            ? "border-accent/50 bg-accent/15 text-foreground"
            : "border-border/60 bg-card text-muted-foreground hover:border-border hover:text-foreground",
          disabled && "pointer-events-none opacity-50",
        )}
        aria-pressed={value === NEWS_FILTER_ALL}
      >
        <LayoutGrid className="size-4" aria-hidden />
        {NEWS_FILTER_LABELS.all}
      </button>
      {NEWS_PLATFORM_ORDER.map((platform) => (
        <NewsPlatformChip
          key={platform}
          platform={platform}
          selected={value === platform}
          onSelect={() => onChange(platform)}
          disabled={disabled || !availablePlatforms.has(platform)}
        />
      ))}
    </div>
  );
}

export function NewsPlatformChip({
  platform,
  selected,
  onSelect,
  disabled,
}: {
  platform: NewsPlatform;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        selected
          ? "border-accent/50 bg-accent/15 text-foreground"
          : "border-border/60 bg-card text-muted-foreground hover:border-border hover:text-foreground",
        disabled && "pointer-events-none opacity-50",
      )}
      aria-pressed={selected}
    >
      <NewsPlatformIcon platform={platform} />
      {NEWS_PLATFORM_LABELS[platform]}
    </button>
  );
}

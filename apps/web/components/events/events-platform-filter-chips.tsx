"use client";

import { LayoutGrid } from "lucide-react";
import { EventsPlatformIcon } from "@/components/events/events-platform-icon";
import {
  EVENTS_FILTER_ALL,
  EVENTS_FILTER_LABELS,
  EVENTS_PLATFORM_LABELS,
  EVENTS_PLATFORM_ORDER,
  type EventsPlatform,
  type EventsPlatformFilter,
} from "@/lib/constants/events-platforms";
import { cn } from "@/lib/utils";

export function EventsPlatformFilterChips({
  value,
  onChange,
  availablePlatforms,
  showAllChip = true,
  disabled,
}: {
  value: EventsPlatformFilter;
  onChange: (next: EventsPlatformFilter) => void;
  availablePlatforms: Set<string>;
  showAllChip?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {showAllChip ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(EVENTS_FILTER_ALL)}
          className={cn(
            "inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
            value === EVENTS_FILTER_ALL
              ? "border-accent/50 bg-accent/15 text-foreground"
              : "border-border/60 bg-card text-muted-foreground hover:border-border hover:text-foreground",
            disabled && "pointer-events-none opacity-50",
          )}
          aria-pressed={value === EVENTS_FILTER_ALL}
        >
          <LayoutGrid className="size-4 shrink-0" aria-hidden />
          <span>{EVENTS_FILTER_LABELS.all}</span>
        </button>
      ) : null}
      {EVENTS_PLATFORM_ORDER.filter(
        (platform) =>
          availablePlatforms.has(platform) &&
          (platform === "gwada" ||
            platform === "facebook" ||
            platform === "google_business"),
      ).map((platform) => (
        <EventsPlatformChip
          key={platform}
          platform={platform}
          selected={value === platform}
          onSelect={() => onChange(platform)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

export function EventsPlatformChip({
  platform,
  selected,
  onSelect,
  disabled,
}: {
  platform: EventsPlatform;
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
        "inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        selected
          ? "border-accent/50 bg-accent/15 text-foreground"
          : "border-border/60 bg-card text-muted-foreground hover:border-border hover:text-foreground",
        disabled && "pointer-events-none opacity-50",
      )}
      aria-pressed={selected}
    >
      <EventsPlatformIcon platform={platform} className="size-4" />
      <span>{EVENTS_PLATFORM_LABELS[platform]}</span>
    </button>
  );
}

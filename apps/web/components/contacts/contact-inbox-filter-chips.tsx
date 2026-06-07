"use client";

import { LayoutGrid } from "lucide-react";
import { ContactMessagePlatformChip } from "@/components/contacts/contact-message-platform-chip";
import {
  INBOX_PLATFORM_FILTER_ORDER,
  INBOX_FILTER_ALL,
  INBOX_FILTER_LABELS,
  type InboxPlatformFilter,
} from "@/lib/constants/contact-message-platforms";
import { cn } from "@/lib/utils";

export function ContactInboxFilterChips({
  filter,
  onFilterChange,
  isPlatformAvailable,
  disabled,
}: {
  filter: InboxPlatformFilter;
  onFilterChange: (filter: InboxPlatformFilter) => void;
  isPlatformAvailable: (p: InboxPlatformFilter) => boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <button
        type="button"
        disabled={disabled || !isPlatformAvailable(INBOX_FILTER_ALL)}
        onClick={() => onFilterChange(INBOX_FILTER_ALL)}
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
          filter === INBOX_FILTER_ALL
            ? "border-accent/50 bg-accent/15 text-foreground"
            : "border-border/60 bg-card text-muted-foreground hover:border-border hover:text-foreground",
          disabled && "pointer-events-none opacity-50",
        )}
        aria-pressed={filter === INBOX_FILTER_ALL}
      >
        <LayoutGrid className="size-4" aria-hidden />
        {INBOX_FILTER_LABELS.all}
      </button>
      {INBOX_PLATFORM_FILTER_ORDER.map((p) => (
        <ContactMessagePlatformChip
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

"use client";

import { LayoutGrid } from "lucide-react";
import { ContactPlatformChip } from "@/components/contacts/contact-platform-chip";
import {
  CONTACT_CATALOG_FILTER_ALL,
  CONTACT_CATALOG_FILTER_LABELS,
  CONTACT_CATALOG_PLATFORM_ORDER,
  type ContactCatalogPlatform,
  type ContactCatalogPlatformFilter,
} from "@/lib/constants/contact-catalog-platforms";
import { cn } from "@/lib/utils";

export function ContactCatalogFilterChips({
  filter,
  onFilterChange,
  isPlatformAvailable,
  disabled,
}: {
  filter: ContactCatalogPlatformFilter;
  onFilterChange: (filter: ContactCatalogPlatformFilter) => void;
  isPlatformAvailable: (p: ContactCatalogPlatform) => boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onFilterChange(CONTACT_CATALOG_FILTER_ALL)}
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
          filter === CONTACT_CATALOG_FILTER_ALL
            ? "border-accent/50 bg-accent/15 text-foreground"
            : "border-border/60 bg-card text-muted-foreground hover:border-border hover:text-foreground",
          disabled && "pointer-events-none opacity-50",
        )}
        aria-pressed={filter === CONTACT_CATALOG_FILTER_ALL}
      >
        <LayoutGrid className="size-4" aria-hidden />
        {CONTACT_CATALOG_FILTER_LABELS.all}
      </button>
      {CONTACT_CATALOG_PLATFORM_ORDER.filter((p) => isPlatformAvailable(p)).map(
        (p) => (
        <ContactPlatformChip
          key={p}
          platform={p}
          selected={filter === p}
          onSelect={() => onFilterChange(p)}
          disabled={disabled}
        />
      ),
      )}
    </div>
  );
}

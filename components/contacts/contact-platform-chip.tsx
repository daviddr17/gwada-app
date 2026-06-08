"use client";

import { ContactPlatformIcon } from "@/components/contacts/contact-platform-icon";
import {
  CONTACT_CATALOG_PLATFORM_LABELS,
  type ContactCatalogPlatform,
} from "@/lib/constants/contact-catalog-platforms";
import { cn } from "@/lib/utils";

export function ContactPlatformChip({
  platform,
  selected,
  onSelect,
  disabled,
}: {
  platform: ContactCatalogPlatform;
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
      <ContactPlatformIcon platform={platform} />
      {CONTACT_CATALOG_PLATFORM_LABELS[platform]}
    </button>
  );
}

"use client";

import { LayoutGrid } from "lucide-react";
import { ContactPlatformChip } from "@/components/contacts/contact-platform-chip";
import {
  ACCOUNTING_FILTER_ALL,
  ACCOUNTING_FILTER_LABELS,
  ACCOUNTING_PLATFORMS,
  type AccountingPlatform,
  type AccountingPlatformFilter,
} from "@/lib/constants/accounting-platforms";
import { cn } from "@/lib/utils";

export function AccountingFilterChips({
  filter,
  onFilterChange,
  externalConnectorConnected,
  lexofficeConnected,
  disabled,
}: {
  filter: AccountingPlatformFilter;
  onFilterChange: (filter: AccountingPlatformFilter) => void;
  /** Externer Buchhaltungs-Connector aktiv (z. B. Lexware). */
  externalConnectorConnected?: boolean;
  /** @deprecated externalConnectorConnected */
  lexofficeConnected?: boolean;
  disabled?: boolean;
}) {
  const connectorActive =
    externalConnectorConnected ?? lexofficeConnected ?? false;
  return (
    <div className="flex flex-wrap gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onFilterChange(ACCOUNTING_FILTER_ALL)}
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
          filter === ACCOUNTING_FILTER_ALL
            ? "border-accent/50 bg-accent/15 text-foreground"
            : "border-border/60 bg-card text-muted-foreground hover:border-border hover:text-foreground",
          disabled && "pointer-events-none opacity-50",
        )}
        aria-pressed={filter === ACCOUNTING_FILTER_ALL}
      >
        <LayoutGrid className="size-4" aria-hidden />
        {ACCOUNTING_FILTER_LABELS.all}
      </button>
      {ACCOUNTING_PLATFORMS.map((platform) => {
        const unavailable =
          platform !== "gwada" && !connectorActive;
        return (
          <ContactPlatformChip
            key={platform}
            platform={platform as AccountingPlatform}
            selected={filter === platform}
            onSelect={() => onFilterChange(platform)}
            disabled={disabled || unavailable}
          />
        );
      })}
    </div>
  );
}

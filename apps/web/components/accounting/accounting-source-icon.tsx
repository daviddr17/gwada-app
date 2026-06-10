"use client";

import { ContactPlatformIcon } from "@/components/contacts/contact-platform-icon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ACCOUNTING_PLATFORM_LABELS,
  isAccountingPlatform,
} from "@/lib/constants/accounting-platforms";
import type { ContactCatalogPlatform } from "@/lib/constants/contact-catalog-platforms";
import type { AccountingSource } from "@/lib/types/accounting";
import { cn } from "@/lib/utils";

function resolvePlatform(source: string): ContactCatalogPlatform {
  return isAccountingPlatform(source) ? source : "gwada";
}

export function AccountingSourceIcon({
  source,
  className,
}: {
  source: AccountingSource | string;
  className?: string;
}) {
  const platform = resolvePlatform(source);
  const label = isAccountingPlatform(source)
    ? ACCOUNTING_PLATFORM_LABELS[source]
    : source;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={cn(
              "inline-flex size-8 items-center justify-center rounded-md",
              className,
            )}
            aria-label={label}
          />
        }
      >
        <ContactPlatformIcon platform={platform} />
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

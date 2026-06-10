"use client";

import type { AccountingDocumentStatusRow } from "@/lib/types/accounting";
import {
  accountingStatusLabel,
  resolveAccountingStatusColor,
} from "@/lib/accounting/accounting-status-labels";
import { restaurantPositionSurfaceStyle } from "@/lib/restaurant/restaurant-position-colors";
import { cn } from "@/lib/utils";

export function AccountingStatusBadge({
  statusCode,
  statuses,
  className,
}: {
  statusCode: string;
  statuses: AccountingDocumentStatusRow[];
  className?: string;
}) {
  const status = statuses.find((s) => s.code === statusCode) ?? null;
  const label = accountingStatusLabel(statusCode, statuses);
  const hex = resolveAccountingStatusColor(status, statusCode);
  const surface = restaurantPositionSurfaceStyle(hex);

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium text-foreground",
        className,
      )}
      style={surface}
    >
      <span
        className="h-3.5 w-1 shrink-0 rounded-full"
        style={{ backgroundColor: hex }}
        aria-hidden
      />
      <span className="truncate">{label}</span>
    </span>
  );
}

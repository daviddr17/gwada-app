"use client";

import {
  PURCHASE_ORDER_STATUS_FILTERS,
  PURCHASE_ORDER_STATUS_LABELS,
  type PurchaseOrderStatusFilter,
} from "@/lib/inventory/purchase-order-status";
import { cn } from "@/lib/utils";

type PurchaseOrderStatusChipsProps = {
  value: PurchaseOrderStatusFilter;
  onChange: (value: PurchaseOrderStatusFilter) => void;
  counts?: Partial<Record<PurchaseOrderStatusFilter, number>>;
  disabled?: boolean;
};

/** Drei große Status-Chips: Offen · Bestellt · Abgeschlossen */
export function PurchaseOrderStatusChips({
  value,
  onChange,
  counts,
  disabled,
}: PurchaseOrderStatusChipsProps) {
  return (
    <div
      className="grid grid-cols-3 gap-2"
      role="tablist"
      aria-label="Bestellstatus filtern"
    >
      {PURCHASE_ORDER_STATUS_FILTERS.map((status) => {
        const selected = value === status;
        const count = counts?.[status];
        return (
          <button
            key={status}
            type="button"
            role="tab"
            aria-selected={selected}
            disabled={disabled}
            onClick={() => onChange(status)}
            className={cn(
              "flex min-h-11 flex-col items-center justify-center rounded-xl border px-2 py-2 text-center transition-colors sm:min-h-12",
              selected
                ? "border-accent/50 bg-accent/15 text-foreground shadow-sm"
                : "border-border/60 bg-card text-muted-foreground hover:border-border hover:text-foreground",
              disabled && "pointer-events-none opacity-50",
            )}
          >
            <span className="text-sm font-semibold tracking-tight sm:text-base">
              {PURCHASE_ORDER_STATUS_LABELS[status]}
            </span>
            {typeof count === "number" ? (
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

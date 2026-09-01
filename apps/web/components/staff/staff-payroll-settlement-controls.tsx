"use client";

import {
  STAFF_PAYROLL_SETTLEMENT_STATUS_LABELS,
} from "@/lib/staff/staff-payroll-settlement";
import type { StaffPayrollSettlementStatus } from "@/lib/types/staff";
import { formatStaffEuroCents } from "@/lib/staff/staff-day-wage";
import { cn } from "@/lib/utils";

export const staffPayrollSettlementStatusChipClass: Record<
  StaffPayrollSettlementStatus,
  string
> = {
  open: "border-border/60 bg-background text-muted-foreground",
  paid: "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  underpaid:
    "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200",
  overpaid:
    "border-sky-500/40 bg-sky-500/10 text-sky-900 dark:text-sky-200",
};

type StaffPayrollSettlementStatusBadgeProps = {
  status: StaffPayrollSettlementStatus;
  openCents: number;
  /** Optional: Überzahlung anzeigen wenn status overpaid. */
  overpaidCreditCents?: number;
  compact?: boolean;
  className?: string;
};

/** Nur Anzeige — Status ergibt sich aus Lohn − Auszahlungen. */
export function StaffPayrollSettlementStatusBadge({
  status,
  openCents,
  overpaidCreditCents = 0,
  compact = false,
  className,
}: StaffPayrollSettlementStatusBadgeProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1",
        compact ? "items-end" : "items-start",
        className,
      )}
    >
      <span
        className={cn(
          "inline-flex rounded-full border px-2.5 py-1 text-xs font-medium",
          staffPayrollSettlementStatusChipClass[status],
        )}
      >
        {STAFF_PAYROLL_SETTLEMENT_STATUS_LABELS[status]}
      </span>
      {status === "overpaid" && overpaidCreditCents > 0 ? (
        <p className="text-xs tabular-nums text-muted-foreground">
          Über {formatStaffEuroCents(overpaidCreditCents)}
        </p>
      ) : (
        <p className="text-xs tabular-nums text-muted-foreground">
          Offen {formatStaffEuroCents(openCents)}
        </p>
      )}
    </div>
  );
}

/** @deprecated Alias — frühere klickbare Controls sind weg. */
export const StaffPayrollSettlementControls =
  StaffPayrollSettlementStatusBadge;

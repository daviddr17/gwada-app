"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  STAFF_PAYROLL_SETTLEMENT_STATUS_LABELS,
} from "@/lib/staff/staff-payroll-settlement";
import { upsertStaffPayrollSettlement } from "@/lib/supabase/staff-payroll-settlements-db";
import type { StaffPayrollSettlementStatus } from "@/lib/types/staff";
import { formatStaffEuroCents } from "@/lib/staff/staff-day-wage";
import { cn } from "@/lib/utils";

const STATUS_ORDER: StaffPayrollSettlementStatus[] = [
  "open",
  "paid",
  "underpaid",
  "overpaid",
];

const statusChipClass: Record<StaffPayrollSettlementStatus, string> = {
  open: "border-border/60 bg-background text-muted-foreground",
  paid: "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  underpaid:
    "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200",
  overpaid:
    "border-sky-500/40 bg-sky-500/10 text-sky-900 dark:text-sky-200",
};

function openCentsForStatus(
  status: StaffPayrollSettlementStatus,
  dueCents: number,
): number {
  if (status === "open") return Math.max(0, dueCents);
  if (status === "paid" || status === "overpaid") return 0;
  if (status === "underpaid") return Math.max(0, dueCents);
  return 0;
}

type StaffPayrollSettlementControlsProps = {
  restaurantId: string;
  staffId: string;
  periodYear: number;
  periodMonth: number;
  status: StaffPayrollSettlementStatus;
  /** Lohn − Vorschüsse (Rest vor Status). */
  dueCents: number;
  /** Offener Rest laut aktuellem Status (Server). */
  openCents: number;
  allowEdit?: boolean;
  compact?: boolean;
  onChanged: () => void;
};

export function StaffPayrollSettlementControls({
  restaurantId,
  staffId,
  periodYear,
  periodMonth,
  status,
  dueCents,
  openCents,
  allowEdit = true,
  compact = false,
  onChanged,
}: StaffPayrollSettlementControlsProps) {
  const [pending, startTransition] = useTransition();
  const [displayStatus, setDisplayStatus] =
    useState<StaffPayrollSettlementStatus>(status);
  const [displayOpenCents, setDisplayOpenCents] = useState(openCents);

  useEffect(() => {
    setDisplayStatus(status);
    setDisplayOpenCents(openCents);
  }, [status, openCents]);

  const applyStatus = (next: StaffPayrollSettlementStatus) => {
    if (!allowEdit || pending || next === displayStatus) return;
    const prevStatus = displayStatus;
    const prevOpen = displayOpenCents;
    setDisplayStatus(next);
    setDisplayOpenCents(openCentsForStatus(next, dueCents));

    startTransition(async () => {
      let amountCents = 0;
      if (next === "paid") amountCents = Math.max(0, dueCents);
      else if (next === "underpaid") {
        amountCents = Math.max(0, dueCents);
      } else if (next === "overpaid") {
        amountCents = Math.max(0, -dueCents);
      }

      const { error } = await upsertStaffPayrollSettlement({
        restaurantId,
        staffId,
        periodYear,
        periodMonth,
        status: next,
        amountCents,
      });
      if (error) {
        setDisplayStatus(prevStatus);
        setDisplayOpenCents(prevOpen);
        toast.error(error);
        return;
      }
      toast.success(
        next === "paid"
          ? "Monat als bezahlt markiert"
          : `Status: ${STAFF_PAYROLL_SETTLEMENT_STATUS_LABELS[next]}`,
      );
      onChanged();
    });
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        compact ? "items-end" : "items-stretch",
      )}
    >
      <div className={cn("flex flex-wrap gap-1.5", compact && "justify-end")}>
        {STATUS_ORDER.map((s) => {
          const active = displayStatus === s;
          return (
            <button
              key={s}
              type="button"
              disabled={!allowEdit || pending}
              onClick={(e) => {
                e.stopPropagation();
                applyStatus(s);
              }}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                statusChipClass[s],
                active && "ring-2 ring-ring/40",
                (!allowEdit || pending) && "opacity-70",
              )}
            >
              {STAFF_PAYROLL_SETTLEMENT_STATUS_LABELS[s]}
            </button>
          );
        })}
      </div>
      {!compact ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">
            Offen{" "}
            <span className="font-medium tabular-nums text-foreground">
              {formatStaffEuroCents(displayOpenCents)}
            </span>
            {dueCents !== displayOpenCents ? (
              <span className="text-muted-foreground">
                {" "}
                · Rest vor Status {formatStaffEuroCents(dueCents)}
              </span>
            ) : null}
          </span>
          {allowEdit && displayStatus !== "paid" && dueCents > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={(e) => {
                e.stopPropagation();
                applyStatus("paid");
              }}
            >
              Monat als bezahlt
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="text-xs tabular-nums text-muted-foreground">
          Offen {formatStaffEuroCents(displayOpenCents)}
        </p>
      )}
    </div>
  );
}

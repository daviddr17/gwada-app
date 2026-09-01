"use client";

import { useCallback, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { derivePayrollSettlement } from "@/lib/staff/staff-payroll-settlement";
import { formatStaffEuroCents } from "@/lib/staff/staff-day-wage";
import { upsertStaffWageAdvance } from "@/lib/supabase/staff-wage-advances-db";
import { cn } from "@/lib/utils";

function localTodayYmd(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

/** Datum für Auszahlung: heute im Monat, sonst Monatsanfang. */
export function defaultPaidOnYmdForCalendarMonth(
  year: number,
  month1to12: number,
): string {
  const month = String(month1to12).padStart(2, "0");
  const startYmd = `${year}-${month}-01`;
  const endDay = new Date(year, month1to12, 0).getDate();
  const endYmd = `${year}-${month}-${String(endDay).padStart(2, "0")}`;
  const today = localTodayYmd();
  if (today >= startYmd && today <= endYmd) return today;
  return startYmd;
}

type StaffPayrollQuickSettleButtonProps = {
  restaurantId: string;
  staffId: string;
  staffName?: string;
  wageCents: number;
  payoutCents: number;
  periodYear: number;
  periodMonth: number;
  allowEdit?: boolean;
  onSettled?: () => void;
  /** Sofort Summe in der Tabelle anheben; bei Fehler reload über onSettled. */
  onOptimisticSettle?: (amountCents: number) => void;
  className?: string;
};

/** Auszahlung in Höhe des offenen Lohn-Rests (voller Lohn wenn noch keine Auszahlung). */
export function StaffPayrollQuickSettleButton({
  restaurantId,
  staffId,
  staffName,
  wageCents,
  payoutCents,
  periodYear,
  periodMonth,
  allowEdit = true,
  onSettled,
  onOptimisticSettle,
  className,
}: StaffPayrollQuickSettleButtonProps) {
  const [busy, setBusy] = useState(false);
  const derived = derivePayrollSettlement({ wageCents, payoutCents });
  const amountCents = derived.openCents;
  const canSettle = allowEdit && wageCents > 0 && amountCents > 0;
  const isSettled =
    wageCents > 0 &&
    amountCents === 0 &&
    (derived.status === "paid" || derived.status === "overpaid");

  const handleClick = useCallback(async () => {
    if (!canSettle || busy) return;
    setBusy(true);
    onOptimisticSettle?.(amountCents);
    const paidOn = defaultPaidOnYmdForCalendarMonth(periodYear, periodMonth);
    const result = await upsertStaffWageAdvance({
      restaurantId,
      staffId,
      amountCents,
      paidOn,
      note: null,
    });
    setBusy(false);
    if (!result) {
      toast.error("Auszahlung konnte nicht erfasst werden.");
      onSettled?.();
      return;
    }
    toast.success(`Auszahlung ${formatStaffEuroCents(amountCents)} erfasst`);
    onSettled?.();
  }, [
    amountCents,
    busy,
    canSettle,
    onOptimisticSettle,
    onSettled,
    periodMonth,
    periodYear,
    restaurantId,
    staffId,
  ]);

  if (!allowEdit) return null;

  const ariaLabel = canSettle
    ? staffName
      ? payoutCents > 0
        ? `Restbetrag für ${staffName} auszahlen (${formatStaffEuroCents(amountCents)})`
        : `Lohn für ${staffName} auszahlen (${formatStaffEuroCents(amountCents)})`
      : payoutCents > 0
        ? `Restbetrag auszahlen (${formatStaffEuroCents(amountCents)})`
        : `Lohn auszahlen (${formatStaffEuroCents(amountCents)})`
    : isSettled
      ? "Bezahlt"
      : "Keine Auszahlung möglich";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn(
        "size-8 shrink-0 rounded-full",
        isSettled
          ? "text-emerald-600 dark:text-emerald-400"
          : canSettle
            ? "text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400"
            : "text-muted-foreground/35",
        className,
      )}
      disabled={!canSettle || busy}
      aria-label={ariaLabel}
      title={ariaLabel}
      onClick={() => void handleClick()}
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <CheckCircle2 className="size-4" aria-hidden />
      )}
    </Button>
  );
}

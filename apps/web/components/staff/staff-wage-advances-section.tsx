"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StaffWageAdvanceDrawer } from "@/components/staff/staff-wage-advance-drawer";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { fetchStaffWageAdvancesInRange } from "@/lib/supabase/staff-wage-advances-db";
import { formatStaffEuroCents } from "@/lib/staff/staff-day-wage";
import type { RestaurantStaffWageAdvanceRow } from "@/lib/types/staff";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const paidOnFmt = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatPaidOn(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  return paidOnFmt.format(new Date(y, m - 1, d));
}

function localTodayYmd(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

type StaffWageAdvancesSectionProps = {
  restaurantId: string;
  staffId: string;
  paidOnFromYmd: string;
  paidOnToYmd: string;
  /** Lohn aus Arbeitszeiten (für Restbetrag). */
  wageCents: number;
  allowEdit?: boolean;
};

export function StaffWageAdvancesSection({
  restaurantId,
  staffId,
  paidOnFromYmd,
  paidOnToYmd,
  wageCents,
  allowEdit = true,
}: StaffWageAdvancesSectionProps) {
  const [advances, setAdvances] = useState<RestaurantStaffWageAdvanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editAdvance, setEditAdvance] =
    useState<RestaurantStaffWageAdvanceRow | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await fetchStaffWageAdvancesInRange(
      restaurantId,
      staffId,
      paidOnFromYmd,
      paidOnToYmd,
    );
    setLoading(false);
    if (error) {
      toast.error(error);
      setAdvances([]);
      return;
    }
    setAdvances(data);
  }, [restaurantId, staffId, paidOnFromYmd, paidOnToYmd]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const totalAdvanceCents = useMemo(
    () => advances.reduce((sum, row) => sum + row.amount_cents, 0),
    [advances],
  );

  const remainingCents = wageCents - totalAdvanceCents;

  const defaultPaidOn = useMemo(() => {
    const today = localTodayYmd();
    if (today >= paidOnFromYmd && today <= paidOnToYmd) return today;
    return paidOnFromYmd;
  }, [paidOnFromYmd, paidOnToYmd]);

  return (
    <div className="mt-4 space-y-3 border-t border-border/40 pt-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Lohnvorschüsse</h3>
        {totalAdvanceCents > 0 ? (
          <span className="text-sm tabular-nums text-muted-foreground">
            Summe {formatStaffEuroCents(totalAdvanceCents)}
          </span>
        ) : null}
      </div>

      {allowEdit ? (
        <Button
          type="button"
          size="lg"
          className={modulePrimaryAddButtonFullWidthClassName}
          onClick={() => {
            setEditAdvance(null);
            setDrawerOpen(true);
          }}
        >
          <Plus className="size-4" />
          Lohnvorschuss erfassen
        </Button>
      ) : null}

      {showSkeleton ? (
        <div className="space-y-2" aria-busy>
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      ) : advances.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Im gewählten Monat sind keine Lohnvorschüsse erfasst.
        </p>
      ) : (
        <ul className="divide-y divide-border/40 overflow-hidden rounded-xl border border-border/50">
          {advances.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                  allowEdit && "hover:bg-muted/40",
                )}
                disabled={!allowEdit}
                onClick={() => {
                  if (!allowEdit) return;
                  setEditAdvance(row);
                  setDrawerOpen(true);
                }}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium tabular-nums">
                    {formatStaffEuroCents(row.amount_cents)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatPaidOn(row.paid_on)}
                    {row.note ? ` · ${row.note}` : null}
                  </p>
                </div>
                {allowEdit ? (
                  <Pencil className="size-4 shrink-0 text-muted-foreground" />
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}

      {wageCents > 0 || totalAdvanceCents > 0 ? (
        <div className="space-y-1 rounded-xl bg-muted/40 px-3 py-2.5 text-sm">
          <p className="flex justify-between gap-3">
            <span className="text-muted-foreground">Lohn</span>
            <span className="tabular-nums font-medium">
              {formatStaffEuroCents(wageCents)}
            </span>
          </p>
          <p className="flex justify-between gap-3">
            <span className="text-muted-foreground">Vorschüsse</span>
            <span className="tabular-nums font-medium">
              −{formatStaffEuroCents(totalAdvanceCents)}
            </span>
          </p>
          <p className="flex justify-between gap-3 border-t border-border/40 pt-1.5">
            <span className="font-medium">Rest</span>
            <span className="tabular-nums font-semibold">
              {formatStaffEuroCents(remainingCents)}
            </span>
          </p>
        </div>
      ) : null}

      <StaffWageAdvanceDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        restaurantId={restaurantId}
        staffId={staffId}
        advance={editAdvance}
        defaultPaidOn={defaultPaidOn}
        allowEdit={allowEdit}
        onSaved={() => void reload()}
      />
    </div>
  );
}

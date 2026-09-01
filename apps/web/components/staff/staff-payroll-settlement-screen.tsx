"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Banknote, CircleDollarSign, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/ui/date-picker";
import { KpiCard } from "@/components/ui/kpi-card";
import { Label } from "@/components/ui/label";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
import { StaffWorkHoursSubnav } from "@/components/staff/staff-work-hours-subnav";
import { StaffPayrollSettlementStatusBadge } from "@/components/staff/staff-payroll-settlement-controls";
import { StaffWageAdvanceDrawer } from "@/components/staff/staff-wage-advance-drawer";
import {
  defaultPaidOnYmdForCalendarMonth,
  StaffPayrollQuickSettleButton,
} from "@/components/staff/staff-payroll-quick-settle-button";
import {
  clampListPage,
  LIST_PAGE_SIZE_DEFAULT,
  totalPagesFromCount,
} from "@/lib/constants/list-pagination";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { useStaffModuleSelection } from "@/lib/contexts/staff-module-selection-context";
import { currentCalendarMonthYmdRange } from "@/lib/staff/export-staff-work-hours";
import {
  derivePayrollSettlement,
  monthsInclusive,
  payrollPeriodKey,
  targetHoursForCalendarMonth,
} from "@/lib/staff/staff-payroll-settlement";
import {
  computeStaffPeriodPayrollLines,
  findStaffContractForDay,
  formatStaffEuroCents,
} from "@/lib/staff/staff-day-wage";
import { summarizeStaffWorkEntries } from "@/lib/staff/staff-work-hours-summary";
import {
  exclusiveUtcIsoAfterLocalVisibleEnd,
  localDayKey,
  localDayStartToUtcIso,
  startOfLocalDay,
} from "@/lib/reservations/month-range";
import {
  fetchStaffContractsForRestaurant,
  fetchStaffForRestaurant,
  fetchStaffWorkEntriesInRange,
} from "@/lib/supabase/staff-db";
import { fetchRestaurantWageAdvancesInRange } from "@/lib/supabase/staff-wage-advances-db";
import type {
  RestaurantStaffContractRow,
  RestaurantStaffRow,
  RestaurantStaffWageAdvanceRow,
  RestaurantStaffWorkEntryRow,
  StaffPayrollSettlementStatus,
} from "@/lib/types/staff";
import { staffFamilyFirstDisplayName } from "@/lib/types/staff";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { ModulePaginatedDataTable } from "@/lib/ui/module-paginated-data-table";
import {
  moduleDataTableHeadCellClassName,
  moduleDataTableHeadRowClassName,
} from "@/lib/ui/module-data-table";
import { cn } from "@/lib/utils";

function StaffPayrollSettlementSkeleton() {
  return (
    <div className="space-y-3" aria-busy aria-label="Abrechnung wird geladen">
      <div className="grid gap-3 sm:grid-cols-2">
        <SkeletonCardFrame className="h-24" />
        <SkeletonCardFrame className="h-24" />
      </div>
      <SkeletonCardFrame className="space-y-2 p-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </SkeletonCardFrame>
    </div>
  );
}

const monthLabelFmt = new Intl.DateTimeFormat("de-DE", {
  month: "short",
  year: "numeric",
});

function ymdToLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function monthBoundsYmd(
  year: number,
  month1to12: number,
): { startYmd: string; endYmd: string; start: Date; end: Date } {
  const start = new Date(year, month1to12 - 1, 1);
  const end = new Date(year, month1to12, 0);
  return {
    start,
    end,
    startYmd: localDayKey(start),
    endYmd: localDayKey(end),
  };
}

function formatMonthLabel(year: number, month1to12: number): string {
  return monthLabelFmt.format(new Date(year, month1to12 - 1, 1));
}

function formatHoursBalance(h: number): string {
  const sign = h > 0 ? "+" : "";
  return `${sign}${h.toFixed(1).replace(".", ",")} h`;
}

type PayoutDrawerTarget = {
  staffId: string;
  staffName: string;
  defaultPaidOn: string;
};

type PayrollOverviewRow = {
  key: string;
  staffId: string;
  staffName: string;
  periodYear: number;
  periodMonth: number;
  wageCents: number;
  payoutCents: number;
  dueCents: number;
  openCents: number;
  paidCents: number;
  overpaidCreditCents: number;
  status: StaffPayrollSettlementStatus;
  netWorkH: number;
  hoursBalanceH: number | null;
};

function buildPayrollOverviewRows(params: {
  fromYmd: string;
  toYmd: string;
  staffList: readonly RestaurantStaffRow[];
  entries: readonly RestaurantStaffWorkEntryRow[];
  contracts: readonly RestaurantStaffContractRow[];
  advances: readonly RestaurantStaffWageAdvanceRow[];
  staffIdFilter: string | null;
}): PayrollOverviewRow[] {
  const fromYear = Number(params.fromYmd.slice(0, 4));
  const fromMonth = Number(params.fromYmd.slice(5, 7));
  const toYear = Number(params.toYmd.slice(0, 4));
  const toMonth = Number(params.toYmd.slice(5, 7));
  const months = monthsInclusive(fromYear, fromMonth, toYear, toMonth);

  const nameById = new Map(
    params.staffList.map((s) => [s.id, staffFamilyFirstDisplayName(s)]),
  );

  const rows: PayrollOverviewRow[] = [];

  for (const { year, month } of months) {
    const bounds = monthBoundsYmd(year, month);
    const monthEntries = params.entries.filter((e) => {
      const day = localDayKey(new Date(e.starts_at));
      return day >= bounds.startYmd && day <= bounds.endYmd;
    });
    const payrollLines = computeStaffPeriodPayrollLines({
      entries: monthEntries,
      contracts: params.contracts,
      periodStart: startOfLocalDay(bounds.start),
      periodEnd: startOfLocalDay(bounds.end),
    });
    const payrollByStaff = new Map(payrollLines.map((l) => [l.staffId, l]));

    const payoutByStaff = new Map<string, number>();
    for (const a of params.advances) {
      if (a.paid_on < bounds.startYmd || a.paid_on > bounds.endYmd) continue;
      payoutByStaff.set(
        a.staff_id,
        (payoutByStaff.get(a.staff_id) ?? 0) + a.amount_cents,
      );
    }

    const staffIds = new Set<string>();
    for (const id of payrollByStaff.keys()) staffIds.add(id);
    for (const id of payoutByStaff.keys()) staffIds.add(id);

    for (const staffId of staffIds) {
      if (params.staffIdFilter && staffId !== params.staffIdFilter) continue;
      const line = payrollByStaff.get(staffId);
      const wageCents = line?.wageCents ?? 0;
      const payoutCents = payoutByStaff.get(staffId) ?? 0;
      const derived = derivePayrollSettlement({ wageCents, payoutCents });

      let netWorkH = line?.netWorkH ?? 0;
      if (!line) {
        const staffEntries = monthEntries.filter((e) => e.staff_id === staffId);
        if (staffEntries.length > 0) {
          netWorkH =
            Math.round(summarizeStaffWorkEntries([...staffEntries]).netWorkH * 10) /
            10;
        }
      }

      const midMonthYmd = `${year}-${String(month).padStart(2, "0")}-15`;
      const contract = findStaffContractForDay(
        params.contracts,
        staffId,
        midMonthYmd,
      );
      const targetH = targetHoursForCalendarMonth(
        contract?.target_weekly_minutes,
        year,
        month,
      );
      const hoursBalanceH =
        targetH != null
          ? Math.round((netWorkH - targetH) * 10) / 10
          : null;

      if (wageCents === 0 && payoutCents === 0 && netWorkH === 0) {
        continue;
      }

      rows.push({
        key: payrollPeriodKey(year, month, staffId),
        staffId,
        staffName: nameById.get(staffId) ?? "Mitarbeiter",
        periodYear: year,
        periodMonth: month,
        wageCents,
        payoutCents,
        dueCents: derived.dueCents,
        openCents: derived.openCents,
        paidCents: derived.paidCents,
        overpaidCreditCents: derived.overpaidCreditCents,
        status: derived.status,
        netWorkH,
        hoursBalanceH,
      });
    }
  }

  rows.sort((a, b) => {
    const ym = b.periodYear * 100 + b.periodMonth - (a.periodYear * 100 + a.periodMonth);
    if (ym !== 0) return ym;
    return a.staffName.localeCompare(b.staffName, "de");
  });
  return rows;
}

export function StaffPayrollSettlementScreen() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const { selectedStaffId } = useStaffModuleSelection();

  const initialRange = useMemo(() => currentCalendarMonthYmdRange(), []);
  const [fromYmd, setFromYmd] = useState(initialRange.startYmd);
  const [toYmd, setToYmd] = useState(initialRange.endYmd);
  const [page, setPage] = useState(1);

  const [staffList, setStaffList] = useState<RestaurantStaffRow[]>([]);
  const [entries, setEntries] = useState<RestaurantStaffWorkEntryRow[]>([]);
  const [contracts, setContracts] = useState<RestaurantStaffContractRow[]>([]);
  const [advances, setAdvances] = useState<RestaurantStaffWageAdvanceRow[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [payoutDrawerOpen, setPayoutDrawerOpen] = useState(false);
  const [payoutDrawerTarget, setPayoutDrawerTarget] =
    useState<PayoutDrawerTarget | null>(null);
  const showSkeleton = useDeferredSkeleton(loading);

  const rangeInvalid = fromYmd > toYmd;

  const reload = useCallback(async () => {
    if (!restaurantId || rangeInvalid) {
      setLoading(false);
      setEntries([]);
      setAdvances([]);
      return;
    }
    setLoading(true);
    const rangeStart = localDayStartToUtcIso(ymdToLocalDate(fromYmd));
    const rangeEnd = exclusiveUtcIsoAfterLocalVisibleEnd(ymdToLocalDate(toYmd));

    const [staffRes, entriesRes, contractsRes, advancesRes] =
      await Promise.all([
        fetchStaffForRestaurant(restaurantId),
        fetchStaffWorkEntriesInRange(
          restaurantId,
          null,
          rangeStart,
          rangeEnd,
        ),
        fetchStaffContractsForRestaurant(restaurantId),
        fetchRestaurantWageAdvancesInRange(restaurantId, fromYmd, toYmd),
      ]);

    setLoading(false);
    if (staffRes.error) toast.error(staffRes.error);
    else setStaffList(staffRes.data);
    if (entriesRes.error) toast.error(entriesRes.error);
    else setEntries(entriesRes.data);
    if (contractsRes.error) toast.error(contractsRes.error);
    else setContracts(contractsRes.data);
    if (advancesRes.error) toast.error(advancesRes.error);
    else setAdvances(advancesRes.data);
  }, [restaurantId, fromYmd, toYmd, rangeInvalid]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    setPage(1);
  }, [fromYmd, toYmd, selectedStaffId]);

  const rows = useMemo(
    () =>
      buildPayrollOverviewRows({
        fromYmd,
        toYmd,
        staffList,
        entries,
        contracts,
        advances,
        staffIdFilter: selectedStaffId,
      }),
    [
      fromYmd,
      toYmd,
      staffList,
      entries,
      contracts,
      advances,
      selectedStaffId,
    ],
  );

  const openTotalCents = useMemo(
    () => rows.reduce((sum, r) => sum + r.openCents, 0),
    [rows],
  );
  const paidTotalCents = useMemo(
    () => rows.reduce((sum, r) => sum + r.paidCents, 0),
    [rows],
  );

  const totalPages = totalPagesFromCount(rows.length, LIST_PAGE_SIZE_DEFAULT);
  const currentPage = clampListPage(page, totalPages);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * LIST_PAGE_SIZE_DEFAULT;
    return rows.slice(start, start + LIST_PAGE_SIZE_DEFAULT);
  }, [rows, currentPage]);

  const openPayoutDrawer = useCallback((row: PayrollOverviewRow) => {
    setPayoutDrawerTarget({
      staffId: row.staffId,
      staffName: row.staffName,
      defaultPaidOn: defaultPaidOnYmdForCalendarMonth(
        row.periodYear,
        row.periodMonth,
      ),
    });
    setPayoutDrawerOpen(true);
  }, []);

  const applyOptimisticPayout = useCallback(
    (
      row: PayrollOverviewRow,
      amountCents: number,
    ) => {
      if (!restaurantId) return;
      setAdvances((prev) => [
        ...prev,
        {
          id: `optimistic-${row.key}-${Date.now()}`,
          restaurant_id: restaurantId,
          staff_id: row.staffId,
          amount_cents: amountCents,
          paid_on: defaultPaidOnYmdForCalendarMonth(
            row.periodYear,
            row.periodMonth,
          ),
          note: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);
    },
    [restaurantId],
  );

  if (!workspaceReady) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;

  return (
    <>
      <StaffWorkHoursSubnav />
      <div className="space-y-4 pb-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="payroll-from">Von</Label>
            <DatePickerField
              id="payroll-from"
              value={fromYmd}
              onChange={(v) => setFromYmd(v ?? fromYmd)}
              fullWidth
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="payroll-to">Bis</Label>
            <DatePickerField
              id="payroll-to"
              value={toYmd}
              onChange={(v) => setToYmd(v ?? toYmd)}
              minYmd={fromYmd}
              fullWidth
            />
          </div>
        </div>

        {rangeInvalid ? (
          <p className="text-sm text-destructive">
            „Von“ darf nicht nach „Bis“ liegen.
          </p>
        ) : null}

        {showSkeleton ? (
          <StaffPayrollSettlementSkeleton />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <KpiCard
                label="Summe offen"
                value={formatStaffEuroCents(openTotalCents)}
                hint={`${rows.filter((r) => r.openCents > 0).length} Monate mit Rest`}
                icon={CircleDollarSign}
              />
              <KpiCard
                label="Summe ausgezahlt"
                value={formatStaffEuroCents(paidTotalCents)}
                hint={`${rows.filter((r) => r.paidCents > 0).length} Monate mit Auszahlung`}
                icon={Banknote}
              />
            </div>

            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Im gewählten Zeitraum gibt es keine Abrechnungszeilen.
              </p>
            ) : (
              <ModulePaginatedDataTable
                shown={paginatedRows.length}
                totalCount={rows.length}
                itemLabel="Monate"
                page={currentPage}
                totalPages={totalPages}
                canPrevious={currentPage > 1}
                canNext={currentPage < totalPages}
                onPrevious={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <table className="w-full min-w-[52rem] text-sm">
                  <thead>
                    <tr className={moduleDataTableHeadRowClassName}>
                      <th className={moduleDataTableHeadCellClassName}>Name</th>
                      <th className={moduleDataTableHeadCellClassName}>Monat</th>
                      <th
                        className={cn(
                          moduleDataTableHeadCellClassName,
                          "text-right",
                        )}
                      >
                        Lohn
                      </th>
                      <th
                        className={cn(
                          moduleDataTableHeadCellClassName,
                          "text-right",
                        )}
                      >
                        Auszahlungen
                      </th>
                      <th
                        className={cn(
                          moduleDataTableHeadCellClassName,
                          "text-right",
                        )}
                      >
                        Offen
                      </th>
                      <th
                        className={cn(
                          moduleDataTableHeadCellClassName,
                          "text-right",
                        )}
                      >
                        Stundenkonto
                      </th>
                      <th className={moduleDataTableHeadCellClassName}>
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.map((row) => (
                      <tr
                        key={row.key}
                        className="border-b border-border/40 last:border-0"
                      >
                        <td className="px-4 py-2.5 font-medium">
                          {row.staffName}
                        </td>
                        <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                          {formatMonthLabel(row.periodYear, row.periodMonth)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {row.wageCents > 0
                            ? formatStaffEuroCents(row.wageCents)
                            : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-0.5">
                            <span className="tabular-nums">
                              {row.payoutCents > 0
                                ? formatStaffEuroCents(row.payoutCents)
                                : "—"}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="size-8 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
                              aria-label={`Auszahlung für ${row.staffName} erfassen`}
                              onClick={() => openPayoutDrawer(row)}
                            >
                              <Plus className="size-4" />
                            </Button>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                          {formatStaffEuroCents(row.openCents)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                          {row.hoursBalanceH != null
                            ? formatHoursBalance(row.hoursBalanceH)
                            : "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            <StaffPayrollQuickSettleButton
                              restaurantId={restaurantId}
                              staffId={row.staffId}
                              staffName={row.staffName}
                              wageCents={row.wageCents}
                              payoutCents={row.payoutCents}
                              periodYear={row.periodYear}
                              periodMonth={row.periodMonth}
                              onOptimisticSettle={(amountCents) =>
                                applyOptimisticPayout(row, amountCents)
                              }
                              onSettled={() => void reload()}
                            />
                            <StaffPayrollSettlementStatusBadge
                              status={row.status}
                              openCents={row.openCents}
                              overpaidCreditCents={row.overpaidCreditCents}
                              compact
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ModulePaginatedDataTable>
            )}
          </>
        )}
      </div>

      {restaurantId && payoutDrawerTarget ? (
        <StaffWageAdvanceDrawer
          open={payoutDrawerOpen}
          onOpenChange={(open) => {
            setPayoutDrawerOpen(open);
            if (!open) setPayoutDrawerTarget(null);
          }}
          restaurantId={restaurantId}
          staffId={payoutDrawerTarget.staffId}
          advance={null}
          defaultPaidOn={payoutDrawerTarget.defaultPaidOn}
          onSaved={() => {
            void reload();
          }}
        />
      ) : null}
    </>
  );
}

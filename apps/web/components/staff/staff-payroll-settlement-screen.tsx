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
  payrollCarryCentsBeforeMonth,
  payrollPeriodKey,
  targetHoursForCalendarMonth,
  withPayrollCarryForward,
} from "@/lib/staff/staff-payroll-settlement";
import {
  computeStaffPeriodPayrollLines,
  findStaffContractForDay,
  formatStaffEuroCents,
  staffHourlyRateCentsForWorkedHours,
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
  /** Saldo aller früheren Monate. */
  carryCents: number;
  wageCents: number;
  payoutCents: number;
  /** Übertrag + Lohn − Auszahlungen, vorzeichenbehaftet. */
  dueCents: number;
  openCents: number;
  paidCents: number;
  overpaidCreditCents: number;
  status: StaffPayrollSettlementStatus;
  netWorkH: number;
  hoursBalanceH: number | null;
};

function monthSortKey(year: number, month: number): number {
  return year * 100 + month;
}

/** Frühester Monat mit Zeiten oder Auszahlungen, sonst der sichtbare Beginn. */
function earliestPayrollMonth(
  entries: readonly RestaurantStaffWorkEntryRow[],
  advances: readonly RestaurantStaffWageAdvanceRow[],
  fallbackYear: number,
  fallbackMonth: number,
): { year: number; month: number } {
  let best = monthSortKey(fallbackYear, fallbackMonth);
  let year = fallbackYear;
  let month = fallbackMonth;
  for (const entry of entries) {
    const ymd = localDayKey(new Date(entry.starts_at));
    const y = Number(ymd.slice(0, 4));
    const m = Number(ymd.slice(5, 7));
    const key = monthSortKey(y, m);
    if (!y || !m || key >= best) continue;
    best = key;
    year = y;
    month = m;
  }
  for (const advance of advances) {
    const y = Number(advance.paid_on.slice(0, 4));
    const m = Number(advance.paid_on.slice(5, 7));
    const key = monthSortKey(y, m);
    if (!y || !m || key >= best) continue;
    best = key;
    year = y;
    month = m;
  }
  return { year, month };
}

function buildPayrollOverviewRows(params: {
  fromYmd: string;
  toYmd: string;
  staffList: readonly RestaurantStaffRow[];
  entries: readonly RestaurantStaffWorkEntryRow[];
  contracts: readonly RestaurantStaffContractRow[];
  advances: readonly RestaurantStaffWageAdvanceRow[];
  staffIdFilter: string | null;
  staffIdsFilter: readonly string[] | null;
}): PayrollOverviewRow[] {
  const fromYear = Number(params.fromYmd.slice(0, 4));
  const fromMonth = Number(params.fromYmd.slice(5, 7));
  const toYear = Number(params.toYmd.slice(0, 4));
  const toMonth = Number(params.toYmd.slice(5, 7));
  const earliest = earliestPayrollMonth(
    params.entries,
    params.advances,
    fromYear,
    fromMonth,
  );
  const months = monthsInclusive(
    earliest.year,
    earliest.month,
    toYear,
    toMonth,
  );
  const nameById = new Map(
    params.staffList.map((s) => [s.id, staffFamilyFirstDisplayName(s)]),
  );

  type MonthFigure = {
    staffId: string;
    staffName: string;
    periodYear: number;
    periodMonth: number;
    wageCents: number;
    payoutCents: number;
    netWorkH: number;
    hoursBalanceH: number | null;
  };
  const figures: MonthFigure[] = [];

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
      if (
        params.staffIdsFilter &&
        params.staffIdsFilter.length > 0 &&
        !params.staffIdsFilter.includes(staffId)
      ) {
        continue;
      }
      if (params.staffIdFilter && staffId !== params.staffIdFilter) continue;
      const line = payrollByStaff.get(staffId);
      const wageCents = line?.wageCents ?? 0;
      const payoutCents = payoutByStaff.get(staffId) ?? 0;

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

      figures.push({
        staffId,
        staffName: nameById.get(staffId) ?? "Mitarbeiter",
        periodYear: year,
        periodMonth: month,
        wageCents,
        payoutCents,
        netWorkH,
        hoursBalanceH,
      });
    }
  }

  const settled = withPayrollCarryForward(figures);
  const settledByKey = new Map(
    settled.map((row) => [
      payrollPeriodKey(row.periodYear, row.periodMonth, row.staffId),
      row,
    ]),
  );
  const figureByKey = new Map(
    figures.map((row) => [
      payrollPeriodKey(row.periodYear, row.periodMonth, row.staffId),
      row,
    ]),
  );
  const staffWithHistory = new Set(figures.map((row) => row.staffId));
  const rows: PayrollOverviewRow[] = [];

  for (const { year, month } of monthsInclusive(
    fromYear,
    fromMonth,
    toYear,
    toMonth,
  )) {
    const staffIds = new Set<string>();
    for (const figure of figures) {
      if (figure.periodYear === year && figure.periodMonth === month) {
        staffIds.add(figure.staffId);
      }
    }
    for (const staffId of staffWithHistory) {
      if (payrollCarryCentsBeforeMonth(settled, staffId, year, month) !== 0) {
        staffIds.add(staffId);
      }
    }

    for (const staffId of staffIds) {
      if (
        params.staffIdsFilter &&
        params.staffIdsFilter.length > 0 &&
        !params.staffIdsFilter.includes(staffId)
      ) {
        continue;
      }
      if (params.staffIdFilter && staffId !== params.staffIdFilter) continue;

      const key = payrollPeriodKey(year, month, staffId);
      const figure = figureByKey.get(key);
      const existing = settledByKey.get(key);
      const derived =
        existing ??
        derivePayrollSettlement({
          wageCents: 0,
          payoutCents: 0,
          carryCents: payrollCarryCentsBeforeMonth(
            settled,
            staffId,
            year,
            month,
          ),
        });
      const wageCents = figure?.wageCents ?? 0;
      const payoutCents = figure?.payoutCents ?? 0;
      const netWorkH = figure?.netWorkH ?? 0;
      if (
        wageCents === 0 &&
        payoutCents === 0 &&
        netWorkH === 0 &&
        derived.carryCents === 0
      ) {
        continue;
      }

      rows.push({
        key,
        staffId,
        staffName: figure?.staffName ?? nameById.get(staffId) ?? "Mitarbeiter",
        periodYear: year,
        periodMonth: month,
        carryCents: derived.carryCents,
        wageCents,
        payoutCents,
        dueCents: derived.dueCents,
        openCents: derived.openCents,
        paidCents: derived.paidCents,
        overpaidCreditCents: derived.overpaidCreditCents,
        status: derived.status,
        netWorkH,
        hoursBalanceH: figure?.hoursBalanceH ?? null,
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
  const { selectedStaffId, selectedStaffIds } = useStaffModuleSelection();

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
    // Übertrag braucht alle Monate vor „Von“, nicht nur das sichtbare Fenster.
    const historyFromYmd = "2000-01-01";
    const rangeStart = localDayStartToUtcIso(ymdToLocalDate(historyFromYmd));
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
        fetchRestaurantWageAdvancesInRange(
          restaurantId,
          historyFromYmd,
          toYmd,
        ),
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

  const staffIdsFilter = useMemo(
    () => (selectedStaffIds.length > 0 ? selectedStaffIds : null),
    [selectedStaffIds],
  );

  useEffect(() => {
    setPage(1);
  }, [fromYmd, toYmd, selectedStaffId, staffIdsFilter]);

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
        staffIdsFilter,
      }),
    [
      fromYmd,
      toYmd,
      staffList,
      entries,
      contracts,
      advances,
      selectedStaffId,
      staffIdsFilter,
    ],
  );

  const latestRowByStaff = useMemo(() => {
    const latest = new Map<string, PayrollOverviewRow>();
    for (const row of rows) {
      const prev = latest.get(row.staffId);
      const key = row.periodYear * 100 + row.periodMonth;
      if (
        !prev ||
        key > prev.periodYear * 100 + prev.periodMonth
      ) {
        latest.set(row.staffId, row);
      }
    }
    return [...latest.values()];
  }, [rows]);

  const openTotalCents = useMemo(
    () => latestRowByStaff.reduce((sum, r) => sum + r.openCents, 0),
    [latestRowByStaff],
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
                hint={`${latestRowByStaff.filter((r) => r.openCents > 0).length} Mitarbeiter mit Rest`}
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
                <table className="w-full min-w-[60rem] text-sm">
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
                        Übertrag
                      </th>
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
                          {formatStaffEuroCents(row.carryCents)}
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
                          {formatStaffEuroCents(row.dueCents)}
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
                              carryCents={row.carryCents}
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
          resolveHourlyRateCents={(paidOn) =>
            staffHourlyRateCentsForWorkedHours(
              contracts,
              payoutDrawerTarget.staffId,
              paidOn,
            )
          }
          onSaved={() => {
            void reload();
          }}
        />
      ) : null}
    </>
  );
}

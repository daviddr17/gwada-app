"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Filter, ScrollText, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ChecklistProtocolFilterDrawer,
  countChecklistProtocolActiveFilters,
} from "@/components/checklisten/checklist-protocol-filter-drawer";
import {
  CHECKLIST_PROTOCOL_DEFAULT_KIND,
  CHECKLIST_PROTOCOL_DEFAULT_PERIOD,
  type ChecklistProtocolDeviationFilter,
  type ChecklistProtocolEntry,
  type ChecklistProtocolKindFilter,
  type ChecklistProtocolPeriodFilter,
  type ChecklistProtocolSortKey,
} from "@/lib/checklisten/checklist-protocol-entries";
import { fetchChecklistProtocolPage } from "@/lib/checklisten/checklist-protocol-client";
import { useChecklistAreasStorage } from "@/lib/hooks/use-checklist-areas-storage";
import { useChecklistDevicesStorage } from "@/lib/hooks/use-checklist-devices-storage";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { hasModuleRead } from "@/lib/permissions/module-crud-permissions";
import { ModuleAccessDenied } from "@/lib/permissions/module-access-denied";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import {
  moduleSearchFilterActiveBadgeClassName,
  moduleSearchFilterButtonClassName,
  moduleSearchFilterButtonWrapClassName,
  moduleSearchFilterRowClassName,
  moduleSearchFieldWrapClassName,
  moduleSearchInputClassName,
} from "@/lib/ui/module-search-filter-toolbar";
import { cn } from "@/lib/utils";
import {
  moduleDataTableHeadCellCompactClassName,
  moduleDataTableHeadRowCompactClassName,
} from "@/lib/ui/module-data-table";
import { ModulePaginatedDataTable } from "@/lib/ui/module-paginated-data-table";
import { fetchAllPaginatedItems } from "@/lib/export/fetch-all-paginated";
import { TableCellTruncateTooltip } from "@/components/ui/table-cell-truncate-tooltip";
import {
  createRestaurantDateTimeFormatter,
  DEFAULT_RESTAURANT_TIMEZONE,
} from "@/lib/restaurant/restaurant-timezone";
import { fetchRestaurantIanaTimezone } from "@/lib/supabase/restaurant-timezone-db";

export function ChecklistProtocolScreen() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const { has, loading: permissionsLoading } = useRestaurantPermissions();
  const canReadTodos = hasModuleRead(has, "staff_todos");

  const areasStorage = useChecklistAreasStorage(restaurantId);
  const devicesStorage = useChecklistDevicesStorage(restaurantId);

  const [rows, setRows] = useState<ChecklistProtocolEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading);

  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterKind, setFilterKind] = useState<ChecklistProtocolKindFilter>(
    CHECKLIST_PROTOCOL_DEFAULT_KIND,
  );
  const [filterPeriod, setFilterPeriod] = useState<ChecklistProtocolPeriodFilter>(
    CHECKLIST_PROTOCOL_DEFAULT_PERIOD,
  );
  const [filterAreaId, setFilterAreaId] = useState("all");
  const [filterDeviceId, setFilterDeviceId] = useState("all");
  const [filterDeviation, setFilterDeviation] =
    useState<ChecklistProtocolDeviationFilter>("all");
  const [sortKey, setSortKey] = useState<ChecklistProtocolSortKey>("newest");
  const [restaurantTimezone, setRestaurantTimezone] = useState(
    DEFAULT_RESTAURANT_TIMEZONE,
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchDebounced(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [
    searchDebounced,
    filterKind,
    filterPeriod,
    filterAreaId,
    filterDeviceId,
    filterDeviation,
    sortKey,
  ]);

  const reload = useCallback(async () => {
    if (!restaurantId || !canReadTodos) return;
    setLoading(true);
    try {
      const timezone = await fetchRestaurantIanaTimezone(restaurantId);
      setRestaurantTimezone(timezone);
      const result = await fetchChecklistProtocolPage({
        restaurantId,
        page,
        search: searchDebounced,
        kind: filterKind,
        period: filterPeriod,
        areaId: filterAreaId,
        deviceId: filterDeviceId,
        deviation: filterDeviation,
        sortKey,
        timeZone: timezone,
      });
      setRows(result.items);
      setPage(result.page);
      setTotalCount(result.totalCount);
      setTotalPages(result.totalPages);
    } catch {
      toast.error("Protokoll konnte nicht geladen werden.");
      setRows([]);
      setTotalCount(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [
    restaurantId,
    canReadTodos,
    page,
    searchDebounced,
    filterKind,
    filterPeriod,
    filterAreaId,
    filterDeviceId,
    filterDeviation,
    sortKey,
  ]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filterActiveCount = countChecklistProtocolActiveFilters({
    kind: filterKind,
    period: filterPeriod,
    areaId: filterAreaId,
    deviceId: filterDeviceId,
    deviation: filterDeviation,
    sortKey,
  });

  const whenFmt = useMemo(
    () => createRestaurantDateTimeFormatter(restaurantTimezone),
    [restaurantTimezone],
  );

  const tableExport = useCallback(async () => {
    if (!restaurantId || !canReadTodos) {
      return {
        documentTitle: "Checklisten-Protokoll",
        filenamePrefix: "checklisten-protokoll",
        headers: ["Zeit", "Typ", "Aufgabe", "Bereich", "Gerät", "Wert", "Nutzer"],
        rows: [] as string[][],
        summaryLine: "0 Einträge",
        orientation: "landscape" as const,
      };
    }

    const all = await fetchAllPaginatedItems((page, pageSize) =>
      fetchChecklistProtocolPage({
        restaurantId,
        page,
        pageSize,
        search: searchDebounced,
        kind: filterKind,
        period: filterPeriod,
        areaId: filterAreaId,
        deviceId: filterDeviceId,
        deviation: filterDeviation,
        sortKey,
        timeZone: restaurantTimezone,
      }),
    );

    const fmt = createRestaurantDateTimeFormatter(restaurantTimezone);

    return {
      documentTitle: "Checklisten-Protokoll",
      filenamePrefix: "checklisten-protokoll",
      headers: ["Zeit", "Typ", "Aufgabe", "Bereich", "Gerät", "Wert", "Nutzer"],
      rows: all.map((e) => [
        fmt.format(new Date(e.at)),
        e.kind === "capture" && e.withinLimits === false
          ? `${e.actionLabel} · Abweichung`
          : e.actionLabel,
        e.title,
        e.areaName ?? "—",
        e.deviceName ?? "—",
        e.value || "—",
        e.actor,
      ]),
      summaryLine: `${all.length} Eintrag${all.length === 1 ? "" : "e"}`,
      orientation: "landscape" as const,
    };
  }, [
    restaurantId,
    canReadTodos,
    searchDebounced,
    filterKind,
    filterPeriod,
    filterAreaId,
    filterDeviceId,
    filterDeviation,
    sortKey,
    restaurantTimezone,
  ]);

  if (!permissionsLoading && !canReadTodos) {
    return <ModuleAccessDenied label="Checklisten" />;
  }
  if (!workspaceReady) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;

  return (
    <div className="w-full pb-16">
      <div className={cn("mb-4 space-y-3")}>
        <div className={moduleSearchFilterRowClassName}>
          <div className={moduleSearchFieldWrapClassName}>
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Aufgabe, Wert, Nutzer …"
              className={moduleSearchInputClassName}
              aria-label="Protokoll durchsuchen"
            />
          </div>
          <div className={moduleSearchFilterButtonWrapClassName}>
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              className={moduleSearchFilterButtonClassName}
              aria-label="Filter"
              onClick={() => setFilterOpen(true)}
            >
              <Filter className="size-4" />
            </Button>
            {filterActiveCount > 0 ? (
              <Badge
                variant="secondary"
                className={moduleSearchFilterActiveBadgeClassName}
              >
                {filterActiveCount}
              </Badge>
            ) : null}
          </div>
        </div>
      </div>

      {loading && !showSkeleton ? (
        <div className="min-h-[22rem]" aria-busy="true" />
      ) : null}
      {showSkeleton ? (
        <div className="min-h-[22rem]" aria-busy="true" aria-label="Protokoll wird geladen" />
      ) : totalCount === 0 ? (
        <Card className="border-border/50 shadow-card">
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <ScrollText className="size-8 opacity-40" aria-hidden />
            {searchDebounced.trim() ||
            filterActiveCount > 0 ||
            filterPeriod !== CHECKLIST_PROTOCOL_DEFAULT_PERIOD
              ? "Keine Treffer für Suche oder Filter."
              : "Noch keine Protokolleinträge."}
          </CardContent>
        </Card>
      ) : (
        <ModulePaginatedDataTable
          page={page}
          totalPages={totalPages}
          shown={rows.length}
          totalCount={totalCount}
          itemLabel="Einträge"
          fullscreenTitle="Protokoll"
          canPrevious={page > 1}
          canNext={page < totalPages}
          onPrevious={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
          tableExport={tableExport}
        >
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className={moduleDataTableHeadRowCompactClassName}>
                <th className={moduleDataTableHeadCellCompactClassName}>Zeit</th>
                <th className={moduleDataTableHeadCellCompactClassName}>Typ</th>
                <th className={moduleDataTableHeadCellCompactClassName}>Aufgabe</th>
                <th className={moduleDataTableHeadCellCompactClassName}>Bereich</th>
                <th className={moduleDataTableHeadCellCompactClassName}>Gerät</th>
                <th className={moduleDataTableHeadCellCompactClassName}>Wert</th>
                <th className={moduleDataTableHeadCellCompactClassName}>Nutzer</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-b border-border/30 last:border-0">
                  <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">
                    {whenFmt.format(new Date(e.at))}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge
                      variant={e.kind === "capture" ? "secondary" : "outline"}
                      className="font-normal"
                    >
                      {e.actionLabel}
                    </Badge>
                    {e.kind === "capture" && e.withinLimits === false ? (
                      <Badge variant="destructive" className="ms-1.5 font-normal">
                        Abweichung
                      </Badge>
                    ) : null}
                  </td>
                  <td className="max-w-[10rem] px-3 py-2.5 font-medium">
                    <TableCellTruncateTooltip text={e.title} />
                  </td>
                  <td className="max-w-[8rem] px-3 py-2.5">
                    {e.areaName ? (
                      <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
                        {e.areaColor ? (
                          <span
                            className="size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: e.areaColor }}
                            aria-hidden
                          />
                        ) : null}
                        <TableCellTruncateTooltip text={e.areaName} />
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="max-w-[8rem] px-3 py-2.5">
                    <TableCellTruncateTooltip text={e.deviceName ?? "—"} />
                  </td>
                  <td className="max-w-xs px-3 py-2.5 text-muted-foreground">
                    <TableCellTruncateTooltip text={e.value || "—"} />
                  </td>
                  <td className="max-w-[9rem] px-3 py-2.5">
                    <TableCellTruncateTooltip text={e.actor} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ModulePaginatedDataTable>
      )}

      <ChecklistProtocolFilterDrawer
        open={filterOpen}
        onOpenChange={setFilterOpen}
        filterKind={filterKind}
        onFilterKindChange={setFilterKind}
        filterPeriod={filterPeriod}
        onFilterPeriodChange={setFilterPeriod}
        filterAreaId={filterAreaId}
        onFilterAreaIdChange={setFilterAreaId}
        filterDeviceId={filterDeviceId}
        onFilterDeviceIdChange={setFilterDeviceId}
        filterDeviation={filterDeviation}
        onFilterDeviationChange={setFilterDeviation}
        sortKey={sortKey}
        onSortKeyChange={setSortKey}
        areas={areasStorage.items}
        devices={devicesStorage.items}
      />
    </div>
  );
}

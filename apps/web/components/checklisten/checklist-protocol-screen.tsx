"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Filter, ScrollText, Search } from "lucide-react";
import { toast } from "sonner";
import { isMissingSchemaError } from "@/lib/supabase/schema-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ComplianceRecordDetailDrawer } from "@/components/compliance/compliance-record-detail-drawer";
import {
  ChecklistProtocolFilterDrawer,
  countChecklistProtocolActiveFilters,
} from "@/components/checklisten/checklist-protocol-filter-drawer";
import {
  buildChecklistProtocolEntries,
  filterChecklistProtocolEntries,
  type ChecklistProtocolDeviationFilter,
  type ChecklistProtocolEntry,
  type ChecklistProtocolKindFilter,
  type ChecklistProtocolPeriodFilter,
  type ChecklistProtocolSortKey,
} from "@/lib/checklisten/checklist-protocol-entries";
import {
  fetchComplianceLogEntries,
  fetchComplianceRecords,
} from "@/lib/supabase/compliance-db";
import {
  fetchStaffTodoCompletionsForProtocol,
  fetchStaffTodoLogEntriesForProtocol,
} from "@/lib/supabase/staff-todos-db";
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
import type { RestaurantComplianceRecordRow } from "@/lib/types/compliance";
import {
  moduleSearchFilterActiveBadgeClassName,
  moduleSearchFilterButtonClassName,
  moduleSearchFilterButtonWrapClassName,
  moduleSearchFilterRowClassName,
  moduleSearchFieldWrapClassName,
  moduleSearchInputClassName,
} from "@/lib/ui/module-search-filter-toolbar";
import { cn } from "@/lib/utils";

const whenFmt = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function ChecklistProtocolScreen() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const { has, loading: permissionsLoading } = useRestaurantPermissions();
  const canReadTodos = hasModuleRead(has, "staff_todos");
  const canReadCompliance = hasModuleRead(has, "compliance");
  const canAccess = canReadTodos || canReadCompliance;

  const areasStorage = useChecklistAreasStorage(restaurantId);
  const devicesStorage = useChecklistDevicesStorage(restaurantId);

  const [entries, setEntries] = useState<ChecklistProtocolEntry[]>([]);
  const [complianceRecords, setComplianceRecords] = useState<
    RestaurantComplianceRecordRow[]
  >([]);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading);

  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterKind, setFilterKind] = useState<ChecklistProtocolKindFilter>("all");
  const [filterPeriod, setFilterPeriod] = useState<ChecklistProtocolPeriodFilter>("all");
  const [filterAreaId, setFilterAreaId] = useState("all");
  const [filterDeviceId, setFilterDeviceId] = useState("all");
  const [filterDeviation, setFilterDeviation] =
    useState<ChecklistProtocolDeviationFilter>("all");
  const [sortKey, setSortKey] = useState<ChecklistProtocolSortKey>("newest");
  const [detailRecord, setDetailRecord] = useState<RestaurantComplianceRecordRow | null>(
    null,
  );

  const reload = useCallback(async () => {
    if (!restaurantId || !canAccess) return;
    setLoading(true);

    const [completions, todoLogs, records, complianceLogs] = await Promise.all([
      canReadTodos
        ? fetchStaffTodoCompletionsForProtocol(restaurantId)
        : Promise.resolve({ data: [], error: null }),
      canReadTodos
        ? fetchStaffTodoLogEntriesForProtocol(restaurantId)
        : Promise.resolve({ data: [], error: null }),
      canReadCompliance
        ? fetchComplianceRecords(restaurantId, { limit: 500 })
        : Promise.resolve({ data: [], error: null }),
      canReadCompliance
        ? fetchComplianceLogEntries(restaurantId)
        : Promise.resolve({ data: [], error: null }),
    ]);

    setLoading(false);

    const errors = [
      completions.error,
      todoLogs.error,
      records.error,
      complianceLogs.error,
    ].filter((e): e is string => Boolean(e) && !isMissingSchemaError(e));
    if (errors.length > 0) toast.error(errors[0]!);

    setComplianceRecords(records.data);
    setEntries(
      buildChecklistProtocolEntries({
        todoCompletions: completions.data,
        todoLogs: todoLogs.data,
        complianceRecords: records.data,
        complianceLogs: complianceLogs.data,
      }),
    );
  }, [restaurantId, canAccess, canReadTodos, canReadCompliance]);

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

  const filtered = useMemo(
    () =>
      filterChecklistProtocolEntries(entries, {
        search,
        kind: filterKind,
        period: filterPeriod,
        areaId: filterAreaId,
        deviceId: filterDeviceId,
        deviation: filterDeviation,
        sortKey,
      }),
    [
      entries,
      search,
      filterKind,
      filterPeriod,
      filterAreaId,
      filterDeviceId,
      filterDeviation,
      sortKey,
    ],
  );

  if (!permissionsLoading && !canAccess) {
    return <ModuleAccessDenied label="Checklisten" />;
  }
  if (!workspaceReady) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;

  return (
    <div className="w-full pb-16">
      <p className="mb-4 text-sm text-muted-foreground">
        Erfassungen am Display und im Dashboard sowie Änderungen an Aufgaben,
        Bereichen und Geräten — filterbar nach Zeit, Bereich und Gerät.
      </p>

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
              placeholder="Aufgabe, Nutzer, Details …"
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
        {filtered.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            {filtered.length} Eintrag{filtered.length === 1 ? "" : "e"}
          </p>
        ) : null}
      </div>

      {showSkeleton ? (
        <p className="text-sm text-muted-foreground">Lade Protokoll …</p>
      ) : filtered.length === 0 ? (
        <Card className="border-border/50 shadow-card">
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <ScrollText className="size-8 opacity-40" aria-hidden />
            {entries.length === 0
              ? "Noch keine Protokolleinträge."
              : "Keine Treffer für Suche oder Filter."}
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/50">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2.5 font-medium">Zeit</th>
                <th className="px-3 py-2.5 font-medium">Typ</th>
                <th className="px-3 py-2.5 font-medium">Aufgabe</th>
                <th className="px-3 py-2.5 font-medium">Bereich</th>
                <th className="px-3 py-2.5 font-medium">Gerät</th>
                <th className="px-3 py-2.5 font-medium">Details</th>
                <th className="px-3 py-2.5 font-medium">Wer</th>
                <th className="px-3 py-2.5 font-medium" aria-label="Aktionen" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
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
                  <td className="max-w-[10rem] truncate px-3 py-2.5 font-medium">
                    {e.title}
                  </td>
                  <td className="px-3 py-2.5">
                    {e.areaName ? (
                      <span className="inline-flex max-w-[8rem] items-center gap-1.5 truncate">
                        {e.areaColor ? (
                          <span
                            className="size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: e.areaColor }}
                            aria-hidden
                          />
                        ) : null}
                        <span className="truncate">{e.areaName}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="max-w-[8rem] truncate px-3 py-2.5">
                    {e.deviceName ?? "—"}
                  </td>
                  <td className="max-w-xs truncate px-3 py-2.5 text-muted-foreground">
                    {e.details || "—"}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{e.actor}</td>
                  <td className="px-3 py-2.5">
                    {e.legacyRecordId ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="rounded-full"
                        aria-label="Details"
                        onClick={() => {
                          const record = complianceRecords.find(
                            (r) => r.id === e.legacyRecordId,
                          );
                          if (record) setDetailRecord(record);
                        }}
                      >
                        <Eye className="size-4" />
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

      <ComplianceRecordDetailDrawer
        open={detailRecord != null}
        onOpenChange={(open) => {
          if (!open) setDetailRecord(null);
        }}
        record={detailRecord}
      />
    </div>
  );
}

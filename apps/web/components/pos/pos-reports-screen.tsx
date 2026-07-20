"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Download,
  FileArchive,
  FileText,
  Filter,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchPosZAutopilotImports,
  retryPosZAutopilotImport,
} from "@/lib/accounting/accounting-api";
import {
  countPosDateRangeFilters,
  PosListFilterDrawer,
} from "@/components/pos/pos-list-filter-drawer";
import { PosZAutopilotCell } from "@/components/pos/pos-z-autopilot-cell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DatePickerField } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import {
  LIST_PAGE_SIZE_DEFAULT,
  clampListPage,
} from "@/lib/constants/list-pagination";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { ModuleAccessDenied } from "@/lib/permissions/module-access-denied";
import {
  hasModuleCreate,
  hasModuleRead,
} from "@/lib/permissions/module-crud-permissions";
import {
  downloadPosBlob,
  downloadPosDsfinvkExport,
  downloadPosSessionDsfinvk,
  fetchPosRegisterSessions,
  openPosXReportPdf,
  openPosZReportPdf,
  pollPosDsfinvkExport,
  posApiErrorLabel,
  startPosDsfinvkExport,
  type PosWebRegisterSessionDto,
} from "@/lib/pos/pos-web-api-client";
import type { PosZAutopilotImportRow } from "@/lib/types/accounting-pos-z-autopilot";
import { moduleDataTableHeadRowClassName } from "@/lib/ui/module-data-table";
import { ModulePaginatedDataTable } from "@/lib/ui/module-paginated-data-table";
import {
  ModuleTableSortHeader,
  type ModuleTableSortDir,
} from "@/lib/ui/module-table-sort-header";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { cn } from "@/lib/utils";

type SessionSortKey = "zNr" | "closedAt" | "closing" | "diff";

function shiftYmdLocal(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d + deltaDays);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function formatCents(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function todayYmdLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function PosReportsScreen() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const { has, loading: permissionsLoading } = useRestaurantPermissions();
  const canExport = has("pos.kasse.export");
  const canReadAutopilot = hasModuleRead(has, "accounting");
  const canRetryAutopilot = hasModuleCreate(has, "accounting");

  const today = useMemo(() => todayYmdLocal(), []);
  const defaultListFrom = useMemo(() => shiftYmdLocal(today, -89), [today]);

  const [sessions, setSessions] = useState<PosWebRegisterSessionDto[]>([]);
  const [autopilotBySession, setAutopilotBySession] = useState<
    Record<string, PosZAutopilotImportRow>
  >({});
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(!ready || loading || permissionsLoading);

  const [xBusy, setXBusy] = useState(false);
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);
  const [exportFrom, setExportFrom] = useState(today);
  const [exportTo, setExportTo] = useState(today);
  const [listFrom, setListFrom] = useState(defaultListFrom);
  const [listTo, setListTo] = useState(today);
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sortKey, setSortKey] = useState<SessionSortKey>("closedAt");
  const [sortDir, setSortDir] = useState<ModuleTableSortDir>("desc");
  const [exportBusy, setExportBusy] = useState(false);

  const rangeInvalid = exportFrom > exportTo;
  const listRangeInvalid = listFrom > listTo;
  const activeFilterCount = countPosDateRangeFilters({
    fromYmd: listFrom,
    toYmd: listTo,
    defaultFromYmd: defaultListFrom,
    defaultToYmd: today,
    selectValue: "all",
  });

  useEffect(() => {
    setPage(1);
  }, [listFrom, listTo]);

  const load = useCallback(async () => {
    if (!restaurantId || !canExport || listRangeInvalid) {
      setSessions([]);
      setAutopilotBySession({});
      setTotalCount(0);
      setTotalPages(1);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await fetchPosRegisterSessions(restaurantId, {
        page,
        pageSize: LIST_PAGE_SIZE_DEFAULT,
        fromYmd: listFrom,
        toYmd: listTo,
      });
      if (!result.ok) {
        toast.error(posApiErrorLabel(result.error));
        setSessions([]);
        setAutopilotBySession({});
        setTotalCount(0);
        setTotalPages(1);
        return;
      }
      const nextSessions = result.data.data;
      setSessions(nextSessions);
      setTotalCount(result.data.totalCount);
      setTotalPages(result.data.totalPages);

      if (canReadAutopilot && nextSessions.length > 0) {
        try {
          const imports = await fetchPosZAutopilotImports(
            restaurantId,
            nextSessions.map((s) => s.id),
          );
          const map: Record<string, PosZAutopilotImportRow> = {};
          for (const row of imports) {
            map[row.pos_register_session_id] = row;
          }
          setAutopilotBySession(map);
        } catch {
          setAutopilotBySession({});
        }
      } else {
        setAutopilotBySession({});
      }
    } finally {
      setLoading(false);
    }
  }, [
    restaurantId,
    canExport,
    canReadAutopilot,
    listFrom,
    listTo,
    listRangeInvalid,
    page,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAutopilotRetry = async (sessionId: string) => {
    if (!restaurantId) return;
    setRowBusyId(`auto-${sessionId}`);
    try {
      const row = await retryPosZAutopilotImport(restaurantId, sessionId);
      if (row) {
        setAutopilotBySession((prev) => ({ ...prev, [sessionId]: row }));
        toast.success("Autopilot erneut ausgeführt");
      } else {
        toast.message("Autopilot ohne Änderung");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Autopilot fehlgeschlagen");
    } finally {
      setRowBusyId(null);
    }
  };

  const handleXReport = async () => {
    if (!restaurantId) return;
    setXBusy(true);
    try {
      const result = await openPosXReportPdf(restaurantId);
      if (!result.ok) toast.error(posApiErrorLabel(result.error));
    } finally {
      setXBusy(false);
    }
  };

  const handleZPdf = async (sessionId: string) => {
    if (!restaurantId) return;
    setRowBusyId(`z-${sessionId}`);
    try {
      const result = await openPosZReportPdf(restaurantId, sessionId);
      if (!result.ok) toast.error(posApiErrorLabel(result.error));
    } finally {
      setRowBusyId(null);
    }
  };

  const handleSessionZip = async (session: PosWebRegisterSessionDto) => {
    if (!restaurantId) return;
    setRowBusyId(`zip-${session.id}`);
    try {
      const dateStr = session.closedAt?.slice(0, 10) ?? session.id.slice(0, 8);
      const result = await downloadPosSessionDsfinvk(
        restaurantId,
        session.id,
        `dsfinvk-${dateStr}.zip`,
      );
      if (!result.ok) toast.error(posApiErrorLabel(result.error));
      else toast.success("DSFinV-K-Download gestartet");
    } finally {
      setRowBusyId(null);
    }
  };

  const handleRangeExport = async () => {
    if (!restaurantId || rangeInvalid) return;
    setExportBusy(true);
    try {
      const started = await startPosDsfinvkExport(
        restaurantId,
        exportFrom,
        exportTo,
      );
      if (!started.ok) {
        toast.error(posApiErrorLabel(started.error));
        return;
      }
      if (started.mode === "zip") {
        downloadPosBlob(
          started.blob,
          `dsfinvk-${exportFrom}${exportFrom !== exportTo ? `-${exportTo}` : ""}.zip`,
        );
        toast.success("DSFinV-K-Export heruntergeladen");
        return;
      }

      let ready = started.ready;
      let exportId = started.exportId;
      for (let i = 0; i < 20 && !ready; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const status = await pollPosDsfinvkExport(restaurantId, exportId);
        if (!status.ok) {
          toast.error(posApiErrorLabel(status.error));
          return;
        }
        ready = status.data.ready;
        exportId = status.data.exportId;
      }
      if (!ready) {
        toast.error("Export noch nicht fertig — später erneut versuchen.");
        return;
      }
      const dl = await downloadPosDsfinvkExport(restaurantId, exportId);
      if (!dl.ok) toast.error(posApiErrorLabel(dl.error));
      else toast.success("DSFinV-K-Export heruntergeladen");
    } finally {
      setExportBusy(false);
    }
  };

  const toggleSort = (key: SessionSortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("desc");
      return;
    }
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  };

  const paginated = useMemo(() => {
    const mul = sortDir === "asc" ? 1 : -1;
    return [...sessions].sort((a, b) => {
      switch (sortKey) {
        case "zNr":
          return ((a.zNr ?? 0) - (b.zNr ?? 0)) * mul;
        case "closing":
          return (
            ((a.closingCashCents ?? 0) - (b.closingCashCents ?? 0)) * mul
          );
        case "diff":
          return (
            ((a.cashDifferenceCents ?? 0) - (b.cashDifferenceCents ?? 0)) *
            mul
          );
        case "closedAt":
        default: {
          const at = a.closedAt ? new Date(a.closedAt).getTime() : 0;
          const bt = b.closedAt ? new Date(b.closedAt).getTime() : 0;
          return (at - bt) * mul;
        }
      }
    });
  }, [sessions, sortKey, sortDir]);

  const currentPage = clampListPage(page, totalPages);

  if (!ready || permissionsLoading) {
    return <WorkspaceRestaurantResolvePlaceholder className="py-10" />;
  }
  if (!restaurantId) {
    return <WorkspaceRestaurantMissingMessage className="py-10" />;
  }
  if (!canExport) {
    return <ModuleAccessDenied label="Kassenberichte" />;
  }
  if (showSkeleton) {
    return (
      <div className="space-y-4 pt-2">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-2">
      <Card className="border-border/50 shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">X-Bericht</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Zwischenbericht der offenen Kassensession (PDF).
          </p>
          <Button
            type="button"
            className={cn(brandActionButtonRoundedClassName, "rounded-xl")}
            disabled={xBusy}
            onClick={() => void handleXReport()}
          >
            {xBusy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <FileText className="size-4" aria-hidden />
            )}
            X-Bericht öffnen
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            DSFinV-K Zeitraum
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pos-dsfinvk-from">Von</Label>
              <DatePickerField
                id="pos-dsfinvk-from"
                value={exportFrom}
                onChange={(v) => setExportFrom(v ?? exportFrom)}
                fullWidth
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pos-dsfinvk-to">Bis</Label>
              <DatePickerField
                id="pos-dsfinvk-to"
                value={exportTo}
                onChange={(v) => setExportTo(v ?? exportTo)}
                minYmd={exportFrom}
                fullWidth
              />
            </div>
          </div>
          {rangeInvalid ? (
            <p className="text-sm text-destructive">
              Das Enddatum muss am oder nach dem Startdatum liegen.
            </p>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            disabled={exportBusy || rangeInvalid}
            onClick={() => void handleRangeExport()}
          >
            {exportBusy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <FileArchive className="size-4" aria-hidden />
            )}
            ZIP exportieren
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">Z-Abschlüsse</p>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="relative rounded-full border-border/60"
            onClick={() => setFilterOpen(true)}
            aria-label="Filter"
          >
            <Filter className="size-4" />
            {activeFilterCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-accent text-[10px] font-medium text-accent-foreground">
                {activeFilterCount}
              </span>
            ) : null}
          </Button>
        </div>
        {listRangeInvalid ? (
          <p className="text-sm text-destructive">
            Das Enddatum muss am oder nach dem Startdatum liegen.
          </p>
        ) : null}
        {totalCount === 0 ? (
          <Card className="border-border/50 shadow-card">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/50 bg-muted/20 px-4 py-12 text-center">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
                  <FileText
                    className="size-6 text-muted-foreground"
                    aria-hidden
                  />
                </div>
                <p className="text-sm font-medium">Noch keine Z-Abschlüsse</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Nach dem ersten Kassenabschluss erscheinen hier Z-PDF und
                  DSFinV-K-Download.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <ModulePaginatedDataTable
            shown={paginated.length}
            totalCount={totalCount}
            itemLabel="Abschlüsse"
            page={currentPage}
            totalPages={totalPages}
            canPrevious={currentPage > 1}
            canNext={currentPage < totalPages}
            onPrevious={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            <table className="w-full text-sm">
              <thead>
                <tr className={moduleDataTableHeadRowClassName}>
                  <ModuleTableSortHeader
                    label="Z-Nr."
                    sortKey="zNr"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <ModuleTableSortHeader
                    label="Geschlossen"
                    sortKey="closedAt"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <ModuleTableSortHeader
                    label="Endbestand"
                    sortKey="closing"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                    align="right"
                  />
                  <ModuleTableSortHeader
                    label="Differenz"
                    sortKey="diff"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                    align="right"
                  />
                  {canReadAutopilot ? (
                    <th className="px-3 py-2 text-left font-medium">Autopilot</th>
                  ) : null}
                  <th className="px-3 py-2 text-right font-medium">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((session) => {
                  const zBusy = rowBusyId === `z-${session.id}`;
                  const zipBusy = rowBusyId === `zip-${session.id}`;
                  const autoBusy = rowBusyId === `auto-${session.id}`;
                  return (
                    <tr key={session.id} className="border-t border-border/40">
                      <td className="px-3 py-2.5 tabular-nums font-medium">
                        {session.zNr ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {formatDateTime(session.closedAt)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {formatCents(session.closingCashCents)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {formatCents(session.cashDifferenceCents)}
                      </td>
                      {canReadAutopilot ? (
                        <td className="px-3 py-2.5">
                          <PosZAutopilotCell
                            row={autopilotBySession[session.id]}
                            canRetry={canRetryAutopilot}
                            retrying={autoBusy}
                            onRetry={() => void handleAutopilotRetry(session.id)}
                          />
                        </td>
                      ) : null}
                      <td className="px-3 py-2.5">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="rounded-lg"
                            disabled={zBusy || zipBusy || autoBusy}
                            onClick={() => void handleZPdf(session.id)}
                          >
                            {zBusy ? (
                              <Loader2
                                className="size-3.5 animate-spin"
                                aria-hidden
                              />
                            ) : (
                              <FileText className="size-3.5" aria-hidden />
                            )}
                            Z-PDF
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="rounded-lg"
                            disabled={zBusy || zipBusy || autoBusy}
                            onClick={() => void handleSessionZip(session)}
                          >
                            {zipBusy ? (
                              <Loader2
                                className="size-3.5 animate-spin"
                                aria-hidden
                              />
                            ) : (
                              <Download className="size-3.5" aria-hidden />
                            )}
                            DSFinV-K
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ModulePaginatedDataTable>
        )}
      </div>

      <PosListFilterDrawer
        open={filterOpen}
        onOpenChange={setFilterOpen}
        description="Zeitraum für die Z-Abschluss-Liste."
        fromYmd={listFrom}
        toYmd={listTo}
        onFromYmdChange={setListFrom}
        onToYmdChange={setListTo}
        onReset={() => {
          setListFrom(defaultListFrom);
          setListTo(today);
        }}
      />
    </div>
  );
}

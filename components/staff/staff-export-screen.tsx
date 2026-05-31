"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Download } from "lucide-react";
import { toast } from "sonner";
import { DataExportSheet } from "@/components/export/data-export-sheet";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DatePickerField } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import {
  StaffExportEntriesSkeleton,
  StaffExportSummarySkeleton,
} from "@/components/staff/staff-export-skeleton";
import { StaffExportEntriesDrawer } from "@/components/staff/staff-export-entries-drawer";
import { StaffWorkEntryTypeStripe } from "@/components/staff/staff-work-entry-type-stripe";
import { StaffSelectEmployeeHint } from "@/components/staff/staff-select-employee-hint";
import { useStaffModuleSelection } from "@/lib/contexts/staff-module-selection-context";
import { useRestaurantProfile } from "@/lib/contexts/restaurant-profile-context";
import {
  currentCalendarMonthYmdRange,
  downloadStaffWorkHoursCsv,
  downloadStaffWorkHoursPdf,
  groupStaffWorkEntriesByDay,
} from "@/lib/staff/export-staff-work-hours";
import { formatHoursDe, summarizeStaffWorkEntries } from "@/lib/staff/staff-work-hours-summary";
import {
  exclusiveUtcIsoAfterLocalVisibleEnd,
  localDayStartToUtcIso,
} from "@/lib/reservations/month-range";
import { fetchStaffWorkEntriesInRange } from "@/lib/supabase/staff-db";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { STAFF_SUMMARY_LOGGED_COLOR, staffDisplayName } from "@/lib/types/staff";
import type { RestaurantStaffWorkEntryRow } from "@/lib/types/staff";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";

function ymdToLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function StaffExportScreen() {
  const { profile } = useRestaurantProfile();
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const { selectedStaff, selectedStaffId } = useStaffModuleSelection();

  const initialRange = useMemo(() => currentCalendarMonthYmdRange(), []);
  const [startYmd, setStartYmd] = useState(initialRange.startYmd);
  const [endYmd, setEndYmd] = useState(initialRange.endYmd);
  const [entries, setEntries] = useState<RestaurantStaffWorkEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading);
  const [exportOpen, setExportOpen] = useState(false);
  const [entriesSheetOpen, setEntriesSheetOpen] = useState(false);

  const rangeInvalid = startYmd > endYmd;

  const reload = useCallback(async () => {
    if (!restaurantId || !selectedStaffId || rangeInvalid) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const rangeStart = localDayStartToUtcIso(ymdToLocalDate(startYmd));
    const rangeEnd = exclusiveUtcIsoAfterLocalVisibleEnd(
      ymdToLocalDate(endYmd),
    );
    const { data, error } = await fetchStaffWorkEntriesInRange(
      restaurantId,
      selectedStaffId,
      rangeStart,
      rangeEnd,
    );
    setLoading(false);
    if (error) {
      toast.error(error);
      setEntries([]);
    } else {
      setEntries(data);
    }
  }, [restaurantId, selectedStaffId, startYmd, endYmd, rangeInvalid]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const summary = useMemo(() => summarizeStaffWorkEntries(entries), [entries]);
  const byDay = useMemo(() => groupStaffWorkEntriesByDay(entries), [entries]);
  const count = entries.length;
  const restaurantName = profile.name.trim() || undefined;

  if (!workspaceReady) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;
  if (!selectedStaff) return <StaffSelectEmployeeHint />;

  const exportOptions = {
    restaurantName,
    staff: selectedStaff,
    rangeStartYmd: startYmd,
    rangeEndYmd: endYmd,
    summary,
  };

  return (
    <>
      <div className="mx-auto max-w-2xl space-y-4 pb-16">
        <Card className="border-border/50 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Zeitraum</CardTitle>
            <CardDescription>
              Arbeitszeiten, Pausen und Urlaub für{" "}
              <span className="font-medium text-foreground">
                {staffDisplayName(selectedStaff)}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="staff-export-start">Startdatum</Label>
              <DatePickerField
                id="staff-export-start"
                value={startYmd}
                onChange={(v) => setStartYmd(v ?? startYmd)}
                fullWidth
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-export-end">Enddatum</Label>
              <DatePickerField
                id="staff-export-end"
                value={endYmd}
                onChange={(v) => setEndYmd(v ?? endYmd)}
                minYmd={startYmd}
                fullWidth
              />
            </div>
            {rangeInvalid ? (
              <p className="text-sm text-destructive sm:col-span-2">
                Das Enddatum muss am oder nach dem Startdatum liegen.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Zusammenfassung</CardTitle>
            <CardDescription>
              {!showSkeleton
                ? rangeInvalid
                  ? "Ungültiger Zeitraum"
                  : `${startYmd} – ${endYmd}`
                : null}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            {loading && !showSkeleton ? (
              <div className="min-h-5 sm:col-span-2 lg:col-span-4" aria-busy="true" />
            ) : null}
            {showSkeleton ? (
              <StaffExportSummarySkeleton className="sm:col-span-2 lg:col-span-4" />
            ) : (
              <>
            <p className="flex items-center gap-2">
              <StaffWorkEntryTypeStripe
                color={STAFF_SUMMARY_LOGGED_COLOR}
                className="h-4 self-center"
              />
              <span>
                Eingeloggt:{" "}
                <span className="font-medium tabular-nums">
                  {formatHoursDe(summary.loggedH)}
                </span>
              </span>
            </p>
            <p className="flex items-center gap-2">
              <StaffWorkEntryTypeStripe
                type="break"
                className="h-4 self-center"
              />
              <span>
                Pause:{" "}
                <span className="font-medium tabular-nums">
                  {formatHoursDe(summary.breakH)}
                </span>
              </span>
            </p>
            <p className="flex items-center gap-2">
              <StaffWorkEntryTypeStripe
                type="work"
                className="h-4 self-center"
              />
              <span>
                Arbeitszeit:{" "}
                <span className="font-medium tabular-nums">
                  {formatHoursDe(summary.netWorkH)}
                </span>
              </span>
            </p>
            <p className="flex items-center gap-2">
              <StaffWorkEntryTypeStripe
                type="vacation"
                className="h-4 self-center"
              />
              <span>
                Urlaub:{" "}
                <span className="font-medium tabular-nums">
                  {summary.vacationDays}
                </span>
              </span>
            </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Einträge</CardTitle>
            {!showSkeleton && !rangeInvalid && count === 0 ? (
              <CardDescription>
                Keine Einträge im gewählten Zeitraum.
              </CardDescription>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-3">
            {loading && !showSkeleton ? (
              <div className="min-h-12" aria-busy="true" />
            ) : null}
            {showSkeleton ? <StaffExportEntriesSkeleton /> : null}
            {!showSkeleton && !rangeInvalid && count === 0 ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : null}
            {!showSkeleton && !rangeInvalid && count > 0 ? (
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 rounded-xl border border-border/40 bg-muted/20 px-3 py-3 text-left text-sm font-medium transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setEntriesSheetOpen(true)}
                aria-label={`${count} Einträge anzeigen`}
              >
                <span>
                  {count} Eintrag{count === 1 ? "" : "e"} anzeigen
                </span>
                <ChevronRight className="size-4 shrink-0 text-accent" />
              </button>
            ) : null}
          </CardContent>
        </Card>

        <Button
          type="button"
          className="h-12 w-full gap-2 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90"
          disabled={loading || showSkeleton || rangeInvalid || count === 0}
          onClick={() => setExportOpen(true)}
        >
          <Download className="size-4" />
          Exportieren …
        </Button>
      </div>

      <StaffExportEntriesDrawer
        open={entriesSheetOpen}
        onOpenChange={setEntriesSheetOpen}
        title="Einträge im Zeitraum"
        description={`${count} Eintrag${count === 1 ? "" : "e"} · ${startYmd} – ${endYmd}`}
        days={byDay}
      />

      <DataExportSheet
        open={exportOpen}
        onOpenChange={setExportOpen}
        title="Arbeitszeiten exportieren"
        description={`${staffDisplayName(selectedStaff)} · ${startYmd} – ${endYmd} · ${count} Eintrag${count === 1 ? "" : "e"}`}
        itemCount={count}
        emptyLabel="Keine Einträge im Zeitraum."
        onCsv={() => {
          try {
            downloadStaffWorkHoursCsv(entries, exportOptions);
            toast.success("CSV wurde heruntergeladen.");
            setExportOpen(false);
          } catch {
            toast.error("CSV-Export fehlgeschlagen.");
          }
        }}
        onPdf={() => {
          void (async () => {
            try {
              await downloadStaffWorkHoursPdf(entries, exportOptions);
              toast.success("PDF wurde heruntergeladen.");
              setExportOpen(false);
            } catch {
              toast.error("PDF-Export fehlgeschlagen.");
            }
          })();
        }}
      />
    </>
  );
}

"use client";

import { GWADA_STAFF_DATA_REFRESH_EVENT } from "@/lib/staff/staff-live-events";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Tags } from "lucide-react";
import { toast } from "sonner";
import { CategoriesManageDrawer } from "@/components/menu/categories-manage-drawer";
import { MenuTaxonomyDrawer } from "@/components/menu/menu-taxonomy-drawer";
import { StaffFormDrawer } from "@/components/staff/staff-form-drawer";
import {
  StaffOverviewDayStatsSkeleton,
  StaffOverviewTableSkeleton,
} from "@/components/staff/staff-overview-skeleton";
import { StaffOverviewCompletedShiftsSheet } from "@/components/staff/staff-overview-completed-shifts-sheet";
import { StaffOverviewLivePresenceSheet } from "@/components/staff/staff-overview-live-presence-sheet";
import type { StaffLivePresenceSheetMode } from "@/components/staff/staff-overview-live-presence-sheet";
import { StaffOverviewWageSheet } from "@/components/staff/staff-overview-wage-sheet";
import { StaffOverviewTable } from "@/components/staff/staff-overview-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePickerField } from "@/components/ui/date-picker";
import {
  fetchStaffContractsForRestaurant,
  fetchStaffForRestaurant,
  fetchStaffLivePresence,
  fetchStaffWorkEntriesInRange,
} from "@/lib/supabase/staff-db";
import { useStaffPositionTagsStorage } from "@/lib/hooks/use-staff-position-tags-storage";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import {
  localDayStartToUtcIso,
  exclusiveUtcIsoAfterLocalVisibleEnd,
} from "@/lib/reservations/month-range";
import type {
  RestaurantStaffContractRow,
  RestaurantStaffRow,
  RestaurantStaffWorkEntryRow,
  StaffLivePresenceRow,
} from "@/lib/types/staff";
import { computeStaffDayWageBreakdown, formatStaffEuroCents } from "@/lib/staff/staff-day-wage";
import { listCompletedDisplayShifts } from "@/lib/staff/staff-work-hours-display";
import { cn } from "@/lib/utils";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
function formatEuro(cents: number): string {
  return formatStaffEuroCents(cents);
}

export function StaffOverviewScreen() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const positionTags = useStaffPositionTagsStorage(restaurantId);
  const [rows, setRows] = useState<RestaurantStaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading);
  const [dayDate, setDayDate] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  });
  const [workingIds, setWorkingIds] = useState<Set<string>>(new Set());
  const [breakIds, setBreakIds] = useState<Set<string>>(new Set());
  const [presenceRows, setPresenceRows] = useState<StaffLivePresenceRow[]>([]);
  const [dayEntries, setDayEntries] = useState<RestaurantStaffWorkEntryRow[]>([]);
  const [contracts, setContracts] = useState<RestaurantStaffContractRow[]>([]);
  const [completedSheetOpen, setCompletedSheetOpen] = useState(false);
  const [presenceSheetMode, setPresenceSheetMode] =
    useState<StaffLivePresenceSheetMode | null>(null);
  const [wageSheetOpen, setWageSheetOpen] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editStaff, setEditStaff] = useState<RestaurantStaffRow | null>(null);
  const [manageTagsOpen, setManageTagsOpen] = useState(false);
  const [tagSheet, setTagSheet] = useState<{
    mode: "create" | "edit";
    initial?: { id: string; name: string; active: boolean; backgroundColor: string };
  } | null>(null);

  const reload = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    const { data, error } = await fetchStaffForRestaurant(restaurantId);
    setLoading(false);
    if (error) toast.error(error);
    else setRows(data);
  }, [restaurantId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const reloadContracts = useCallback(async () => {
    if (!restaurantId) return;
    const { data, error } = await fetchStaffContractsForRestaurant(restaurantId);
    if (error) toast.error(error);
    else setContracts(data);
  }, [restaurantId]);

  useEffect(() => {
    void reloadContracts();
  }, [reloadContracts]);

  const reloadDayStats = useCallback(async () => {
    if (!restaurantId || !dayDate) return;
    const [y, m, d] = dayDate.split("-").map(Number);
    const day = new Date(y, m - 1, d);
    const start = localDayStartToUtcIso(day);
    const end = exclusiveUtcIsoAfterLocalVisibleEnd(day);

    const [{ data: presence, error: presenceErr }, { data: entries, error: entriesErr }] =
      await Promise.all([
      fetchStaffLivePresence(restaurantId),
      fetchStaffWorkEntriesInRange(restaurantId, null, start, end),
    ]);

    if (presenceErr) toast.error(presenceErr);
    if (entriesErr) toast.error(entriesErr);

    const working = new Set<string>();
    const onBreak = new Set<string>();
    for (const s of presence) {
      if (s.status === "on_break") onBreak.add(s.staff_id);
      else if (s.status === "working") working.add(s.staff_id);
    }

    setWorkingIds(working);
    setBreakIds(onBreak);
    setPresenceRows(presence);
    setDayEntries(entries);
  }, [restaurantId, dayDate]);

  useEffect(() => {
    void reloadDayStats();
    const onRefresh = () => void reloadDayStats();
    window.addEventListener(GWADA_STAFF_DATA_REFRESH_EVENT, onRefresh);
    return () =>
      window.removeEventListener(GWADA_STAFF_DATA_REFRESH_EVENT, onRefresh);
  }, [reloadDayStats]);

  useEffect(() => {
    const onRefresh = () => void reload();
    window.addEventListener(GWADA_STAFF_DATA_REFRESH_EVENT, onRefresh);
    return () =>
      window.removeEventListener(GWADA_STAFF_DATA_REFRESH_EVENT, onRefresh);
  }, [reload]);

  const activeTags = useMemo(
    () => positionTags.items.filter((t) => t.active),
    [positionTags.items],
  );

  const staffById = useMemo(
    () => new Map(rows.map((r) => [r.id, r] as const)),
    [rows],
  );

  const completedShifts = useMemo(
    () => listCompletedDisplayShifts(dayEntries),
    [dayEntries],
  );

  const wageBreakdown = useMemo(
    () =>
      computeStaffDayWageBreakdown({
        entries: dayEntries,
        contracts,
        dayYmd: dayDate,
      }),
    [dayEntries, contracts, dayDate],
  );

  if (!workspaceReady) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;

  return (
    <div className="w-full space-y-6 pb-16">
      <Card className="border-border/50 shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tagesübersicht</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-xs">
            <DatePickerField value={dayDate} onChange={(v) => setDayDate(v ?? "")} />
          </div>
          {showSkeleton ? (
            <StaffOverviewDayStatsSkeleton />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <button
                type="button"
                onClick={() => setPresenceSheetMode("working")}
                className={cn(
                  "rounded-xl border border-border/50 bg-muted/20 px-4 py-3 text-left transition-colors",
                  "hover:border-accent/35 hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/45",
                )}
              >
                <p className="text-xs text-muted-foreground">Aktiv</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {workingIds.size}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Display-Schicht · tippen für Details
                </p>
              </button>
              <button
                type="button"
                onClick={() => setPresenceSheetMode("on_break")}
                className={cn(
                  "rounded-xl border border-border/50 bg-muted/20 px-4 py-3 text-left transition-colors",
                  "hover:border-accent/35 hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/45",
                )}
              >
                <p className="text-xs text-muted-foreground">In Pause</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {breakIds.size}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Display-Pause · tippen für Details
                </p>
              </button>
              <button
                type="button"
                onClick={() => setCompletedSheetOpen(true)}
                className={cn(
                  "rounded-xl border border-border/50 bg-muted/20 px-4 py-3 text-left transition-colors",
                  "hover:border-accent/35 hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/45",
                )}
              >
                <p className="text-xs text-muted-foreground">Abgeschlossen</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {completedShifts.length}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Display-Schichten · tippen für Details
                </p>
              </button>
              <button
                type="button"
                onClick={() => setWageSheetOpen(true)}
                className={cn(
                  "rounded-xl border border-border/50 bg-muted/20 px-4 py-3 text-left transition-colors",
                  "hover:border-accent/35 hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/45",
                )}
              >
                <p className="text-xs text-muted-foreground">Lohn</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {formatEuro(wageBreakdown.totalCents)}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Stunden × Lohn · tippen für Details
                </p>
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-2">
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            className="h-12 gap-2 rounded-full"
            onClick={() => setManageTagsOpen(true)}
          >
            <Tags className="size-4" />
            Positionen
          </Button>
        </div>
        <Button
          type="button"
          size="lg"
          className={modulePrimaryAddButtonFullWidthClassName}
          onClick={() => {
            setFormMode("create");
            setEditStaff(null);
            setFormOpen(true);
          }}
        >
          <Plus className="size-4" />
          Neuer Mitarbeiter
        </Button>
      </div>

      <Card className="border-border/50 shadow-card">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-base">Alle Mitarbeiter</CardTitle>
          {!showSkeleton ? (
            <span className="text-xs text-muted-foreground tabular-nums">
              {rows.length} {rows.length === 1 ? "Eintrag" : "Einträge"}
            </span>
          ) : null}
        </CardHeader>
        <CardContent className="p-0">
          {loading && !showSkeleton ? (
            <div className="min-h-[22rem]" aria-busy="true" />
          ) : null}
          {showSkeleton ? (
            <StaffOverviewTableSkeleton />
          ) : (
            <StaffOverviewTable
              rows={rows}
              workingIds={workingIds}
              breakIds={breakIds}
              onEdit={(row) => {
                setFormMode("edit");
                setEditStaff(row);
                setFormOpen(true);
              }}
            />
          )}
        </CardContent>
      </Card>

      <StaffFormDrawer
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        restaurantId={restaurantId}
        staff={editStaff}
        activePositionTags={activeTags}
        onSaved={() => void reload()}
      />

      <CategoriesManageDrawer
        open={manageTagsOpen}
        onOpenChange={setManageTagsOpen}
        categories={positionTags.items.map((t) => ({
          id: t.id,
          name: t.name,
          active: t.active,
        }))}
        onReorder={(next) =>
          void positionTags.reorder(
            next.map((n) => {
              const full = positionTags.getById(n.id)!;
              return {
                ...full,
                name: n.name,
                active: n.active ?? true,
              };
            }),
          )
        }
        onEdit={(row) => {
          const full = positionTags.getById(row.id);
          if (full) {
            setTagSheet({
              mode: "edit",
              initial: {
                id: full.id,
                name: full.name,
                active: full.active,
                backgroundColor: full.backgroundColor,
              },
            });
          }
          setManageTagsOpen(false);
        }}
        onNew={() => {
          setTagSheet({ mode: "create" });
          setManageTagsOpen(false);
        }}
        copy={{
          title: "Positionen",
          description: "HR-Positionen für Mitarbeiter (Tags mit Farbe).",
          newButton: "Neue Position",
        }}
        rowLeading={(row) => {
          const def = positionTags.getById(row.id);
          const bg = def?.backgroundColor;
          if (!bg || !/^#[0-9A-Fa-f]{6}$/.test(bg)) return null;
          return (
            <span
              className="size-3 shrink-0 rounded-full border border-border/50"
              style={{ backgroundColor: bg }}
              aria-hidden
            />
          );
        }}
      />

      <MenuTaxonomyDrawer
        open={tagSheet !== null}
        onOpenChange={(o) => {
          if (!o) setTagSheet(null);
        }}
        mode={tagSheet?.mode ?? "create"}
        initial={
          tagSheet?.mode === "edit"
            ? {
                id: tagSheet.initial!.id,
                name: tagSheet.initial!.name,
                active: tagSheet.initial!.active,
                backgroundColor: tagSheet.initial!.backgroundColor,
              }
            : null
        }
        variant="staffPositionTags"
        onSave={(payload) => {
          if ("id" in payload) {
            void positionTags.update(payload.id, {
              name: payload.name,
              active: payload.active,
              backgroundColor: payload.backgroundColor,
            });
          } else {
            void positionTags.add(
              payload.name,
              payload.active,
              payload.backgroundColor,
            );
          }
          setTagSheet(null);
        }}
      />

      <StaffOverviewCompletedShiftsSheet
        open={completedSheetOpen}
        onOpenChange={setCompletedSheetOpen}
        dayYmd={dayDate}
        shifts={completedShifts}
        staffById={staffById}
      />

      {presenceSheetMode ? (
        <StaffOverviewLivePresenceSheet
          open={presenceSheetMode !== null}
          onOpenChange={(open) => {
            if (!open) setPresenceSheetMode(null);
          }}
          mode={presenceSheetMode}
          presence={presenceRows}
          staffById={staffById}
        />
      ) : null}

      <StaffOverviewWageSheet
        open={wageSheetOpen}
        onOpenChange={setWageSheetOpen}
        dayYmd={dayDate}
        breakdown={wageBreakdown}
        staffById={staffById}
      />
    </div>
  );
}

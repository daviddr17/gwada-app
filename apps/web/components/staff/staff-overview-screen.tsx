"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
import { StaffDisplayTimeRequestsPanel } from "@/components/staff/staff-display-time-requests-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePickerField } from "@/components/ui/date-picker";
import { useStaffListQuery } from "@/lib/hooks/use-staff-list-query";
import { useStaffDayStatsQuery } from "@/lib/hooks/use-staff-day-stats-query";
import { useStaffPositionTagsStorage } from "@/lib/hooks/use-staff-position-tags-storage";
import { useStaffEmploymentTypesStorage } from "@/lib/hooks/use-staff-employment-types-storage";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { hasModuleUpdate } from "@/lib/permissions/module-crud-permissions";
import {
  localDayKey,
  startOfLocalDay,
} from "@/lib/reservations/month-range";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import type {
  RestaurantStaffRow,
} from "@/lib/types/staff";
import { computeStaffDayWageBreakdown, formatStaffEuroCents } from "@/lib/staff/staff-day-wage";
import { listCompletedDisplayShifts } from "@/lib/staff/staff-work-hours-display";
import { cn } from "@/lib/utils";
import { StaffPendingInvitesChip } from "@/components/staff/staff-pending-invites-chip";
import { moduleManageChipButtonClassName } from "@/lib/ui/module-manage-chip";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";

function formatEuro(cents: number): string {
  return formatStaffEuroCents(cents);
}

export function StaffOverviewScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const staffIdFromUrl = searchParams.get("staff")?.trim() ?? "";
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const { has } = useRestaurantPermissions();
  const canReviewTimeRequests = hasModuleUpdate(has, "staff");
  const positionTags = useStaffPositionTagsStorage(restaurantId);
  const employmentTypes = useStaffEmploymentTypesStorage(restaurantId);
  const {
    rows,
    contracts,
    isLoading: staffListLoading,
    invalidate: invalidateStaffList,
  } = useStaffListQuery(restaurantId, workspaceReady);
  const showTableSkeleton = useDeferredSkeleton(staffListLoading);
  const [dayDate, setDayDate] = useState(() => localDayKey(new Date()));
  const [liveNow, setLiveNow] = useState(() => new Date());
  const autoFollowTodayRef = useRef(true);
  const openedStaffFromUrlRef = useRef<string | null>(null);
  const {
    workingIds,
    breakIds,
    presenceRows,
    lastDisplayLoginByStaffId,
    dayEntries,
    isLoading: dayStatsLoading,
    invalidate: invalidateDayStats,
  } = useStaffDayStatsQuery(restaurantId, dayDate);
  const showDayStatsSkeleton = useDeferredSkeleton(dayStatsLoading);
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

  const applyStaffRefresh = useCallback(() => {
    invalidateStaffList();
    invalidateDayStats();
  }, [invalidateStaffList, invalidateDayStats]);

  const clearStaffQueryParam = useCallback(() => {
    const p = new URLSearchParams(searchParams.toString());
    if (!p.has("staff")) return;
    p.delete("staff");
    const q = p.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [searchParams, router, pathname]);

  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    setFormMode("create");
    setEditStaff(null);
    setFormOpen(true);
    const p = new URLSearchParams(searchParams.toString());
    p.delete("new");
    const q = p.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [searchParams, router, pathname]);

  /** Glocke / Deep-Link: ?staff=<uuid> öffnet genau diesen Mitarbeiter. */
  useEffect(() => {
    if (!staffIdFromUrl) {
      openedStaffFromUrlRef.current = null;
      return;
    }
    if (!isUuidRestaurantId(staffIdFromUrl)) {
      toast.error("Ungültiger Mitarbeiter-Link.");
      clearStaffQueryParam();
      return;
    }
    if (staffListLoading) return;
    if (openedStaffFromUrlRef.current === staffIdFromUrl) return;

    const row = rows.find((r) => r.id === staffIdFromUrl) ?? null;
    if (!row) {
      toast.error("Mitarbeiter nicht gefunden.");
      openedStaffFromUrlRef.current = staffIdFromUrl;
      clearStaffQueryParam();
      return;
    }

    openedStaffFromUrlRef.current = staffIdFromUrl;
    setFormMode("edit");
    setEditStaff(row);
    setFormOpen(true);
    clearStaffQueryParam();
  }, [
    staffIdFromUrl,
    staffListLoading,
    rows,
    clearStaffQueryParam,
  ]);

  /** Live-Lohn + automatischer Tageswechsel um Mitternacht (nur im „Heute“-Modus). */
  useEffect(() => {
    const tickLive = () => {
      const now = new Date();
      setLiveNow(now);
      if (autoFollowTodayRef.current) {
        const todayKey = localDayKey(now);
        setDayDate((current) => (current === todayKey ? current : todayKey));
      }
    };

    tickLive();
    const intervalId = window.setInterval(tickLive, 30_000);

    let midnightTimerId = 0;
    const scheduleMidnightTick = () => {
      const now = new Date();
      const nextMidnight = startOfLocalDay(now);
      nextMidnight.setDate(nextMidnight.getDate() + 1);
      const delayMs = Math.max(250, nextMidnight.getTime() - now.getTime() + 50);
      midnightTimerId = window.setTimeout(() => {
        tickLive();
        scheduleMidnightTick();
      }, delayMs);
    };
    scheduleMidnightTick();

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(midnightTimerId);
    };
  }, []);

  const activeEmploymentTypes = useMemo(
    () => employmentTypes.items.filter((t) => t.active),
    [employmentTypes.items],
  );

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
        now: liveNow,
      }),
    [dayEntries, contracts, dayDate, liveNow],
  );

  if (!workspaceReady) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;

  return (
    <div className="w-full space-y-6 pb-16">
      {canReviewTimeRequests ? (
        <StaffDisplayTimeRequestsPanel restaurantId={restaurantId} />
      ) : null}

      <Card className="border-border/50 shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tagesübersicht</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-xs">
            <DatePickerField
              value={dayDate}
              onChange={(v) => {
                const next = v ?? "";
                setDayDate(next);
                autoFollowTodayRef.current = next === localDayKey(new Date());
              }}
            />
          </div>
          {showDayStatsSkeleton ? (
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
                <p className="text-xs text-muted-foreground">Live aktiv</p>
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
        <div className="flex flex-wrap items-center justify-end gap-2">
          <StaffPendingInvitesChip restaurantId={restaurantId} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={moduleManageChipButtonClassName}
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

          {staffListLoading && !showTableSkeleton ? (
            <div className="min-h-[22rem]" aria-busy="true" />
          ) : null}
          {showTableSkeleton ? (
            <StaffOverviewTableSkeleton />
          ) : (
            <StaffOverviewTable
              rows={rows}
              workingIds={workingIds}
              breakIds={breakIds}
              lastDisplayLoginByStaffId={lastDisplayLoginByStaffId}
              positionTags={activeTags}
              contracts={contracts}
              employmentTypes={activeEmploymentTypes}
              dayDate={dayDate}
              onEdit={(row) => {
                setFormMode("edit");
                setEditStaff(row);
                setFormOpen(true);
              }}
            />
          )}

      <StaffFormDrawer
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        restaurantId={restaurantId}
        staff={editStaff}
        activePositionTags={activeTags}
        onSaved={applyStaffRefresh}
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
        onDelete={
          tagSheet?.mode === "edit"
            ? (id) => void positionTags.remove(id)
            : undefined
        }
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

"use client";

import { GWADA_STAFF_DATA_REFRESH_EVENT } from "@/lib/staff/staff-live-events";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
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
import {
  fetchStaffContractsForRestaurant,
  fetchStaffForRestaurant,
  fetchStaffLastDisplayLoginByStaffId,
  fetchStaffLivePresence,
  fetchStaffWorkEntriesInRange,
} from "@/lib/supabase/staff-db";
import { useStaffPositionTagsStorage } from "@/lib/hooks/use-staff-position-tags-storage";
import { useStaffEmploymentTypesStorage } from "@/lib/hooks/use-staff-employment-types-storage";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { hasModuleUpdate } from "@/lib/permissions/module-crud-permissions";
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
import {
  peekStaffListCache,
  writeStaffListCache,
} from "@/lib/staff/staff-list-client-cache";
import { listCompletedDisplayShifts } from "@/lib/staff/staff-work-hours-display";
import { cn } from "@/lib/utils";
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
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const { has } = useRestaurantPermissions();
  const canReviewTimeRequests = hasModuleUpdate(has, "staff");
  const positionTags = useStaffPositionTagsStorage(restaurantId);
  const employmentTypes = useStaffEmploymentTypesStorage(restaurantId);
  const [rows, setRows] = useState<RestaurantStaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading && rows.length === 0);
  const [dayDate, setDayDate] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  });
  const [workingIds, setWorkingIds] = useState<Set<string>>(new Set());
  const [breakIds, setBreakIds] = useState<Set<string>>(new Set());
  const [presenceRows, setPresenceRows] = useState<StaffLivePresenceRow[]>([]);
  const [lastDisplayLoginByStaffId, setLastDisplayLoginByStaffId] = useState(
    () => new Map<string, string>(),
  );
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

  const applyCachedStaff = useCallback(
    (cached: ReturnType<typeof peekStaffListCache>) => {
      if (!cached) return;
      setRows(cached.rows);
      setContracts(cached.contracts);
      setLoading(false);
    },
    [],
  );

  useLayoutEffect(() => {
    if (!restaurantId) return;
    applyCachedStaff(peekStaffListCache(restaurantId));
  }, [restaurantId, applyCachedStaff]);

  const reload = useCallback(async () => {
    if (!restaurantId) return;
    const cached = peekStaffListCache(restaurantId);
    if (cached) applyCachedStaff(cached);
    else setLoading(true);

    const [staffRes, contractsRes] = await Promise.all([
      fetchStaffForRestaurant(restaurantId),
      fetchStaffContractsForRestaurant(restaurantId),
    ]);
    setLoading(false);
    if (staffRes.error) toast.error(staffRes.error);
    else setRows(staffRes.data);
    if (contractsRes.error) toast.error(contractsRes.error);
    else setContracts(contractsRes.data);
    if (!staffRes.error && !contractsRes.error) {
      writeStaffListCache(restaurantId, {
        rows: staffRes.data,
        contracts: contractsRes.data,
      });
    }
  }, [restaurantId, applyCachedStaff]);

  useEffect(() => {
    void reload();
  }, [reload]);

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

  const reloadDayStats = useCallback(async () => {
    if (!restaurantId || !dayDate) return;
    const [y, m, d] = dayDate.split("-").map(Number);
    const day = new Date(y, m - 1, d);
    const start = localDayStartToUtcIso(day);
    const end = exclusiveUtcIsoAfterLocalVisibleEnd(day);

    const [
      { data: presence, error: presenceErr },
      { data: entries, error: entriesErr },
      { data: displayLogins, error: displayLoginErr },
    ] = await Promise.all([
      fetchStaffLivePresence(restaurantId),
      fetchStaffWorkEntriesInRange(restaurantId, null, start, end),
      fetchStaffLastDisplayLoginByStaffId(restaurantId),
    ]);

    if (presenceErr) toast.error(presenceErr);
    if (entriesErr) toast.error(entriesErr);
    if (displayLoginErr) toast.error(displayLoginErr);

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
    setLastDisplayLoginByStaffId(displayLogins);
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
      }),
    [dayEntries, contracts, dayDate],
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

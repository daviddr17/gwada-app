"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Filter } from "lucide-react";
import { StaffFormDrawer } from "@/components/staff/staff-form-drawer";
import {
  applyStaffOverviewFilters,
  countStaffOverviewActiveFilters,
  StaffOverviewFilterDrawer,
  STAFF_OVERVIEW_FILTER_DEFAULTS,
  type StaffOverviewFilterState,
} from "@/components/staff/staff-overview-filter-drawer";
import {
  SearchableMultiSelect,
  SearchableSelect,
} from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useStaffModuleSelection } from "@/lib/contexts/staff-module-selection-context";
import { useStaffDayStatsQuery } from "@/lib/hooks/use-staff-day-stats-query";
import { useStaffEmploymentTypesStorage } from "@/lib/hooks/use-staff-employment-types-storage";
import { useStaffListQuery } from "@/lib/hooks/use-staff-list-query";
import {
  buildStaffModulePickerOptions,
  buildStaffSearchableSelectOptions,
  staffModulePickerIdFromSelectValue,
  staffModulePickerSelectValue,
} from "@/lib/staff/staff-select-options";
import { useStaffPositionTagsStorage } from "@/lib/hooks/use-staff-position-tags-storage";
import { fetchStaffForRestaurant } from "@/lib/supabase/staff-db";
import { useCssVarElementHeight } from "@/lib/hooks/use-css-var-element-height";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { localDayKey } from "@/lib/reservations/month-range";
import { STAFF_MODULE_STICKY_BAR_H_VAR } from "@/lib/staff/staff-sticky-chrome";
import type { RestaurantStaffRow } from "@/lib/types/staff";
import {
  moduleSearchFilterActiveBadgeClassName,
} from "@/lib/ui/module-search-filter-toolbar";
import { cn } from "@/lib/utils";

/** Arbeitszeiten startet mit allen Status, damit Inaktive weiter wählbar sind. */
const ARBEITSZEITEN_FILTER_DEFAULTS: StaffOverviewFilterState = {
  ...STAFF_OVERVIEW_FILTER_DEFAULTS,
  statusFilter: "all",
};

function StaffPickerFilterButton({
  count,
  onClick,
}: {
  count: number;
  onClick: () => void;
}) {
  return (
    <div className="relative shrink-0">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-9 rounded-full border-border/60 sm:size-11"
        aria-label="Filter"
        onClick={onClick}
      >
        <Filter className="size-4" />
      </Button>
      {count > 0 ? (
        <Badge
          variant="secondary"
          className={moduleSearchFilterActiveBadgeClassName}
        >
          {count}
        </Badge>
      ) : null}
    </div>
  );
}

export function StaffModuleStickyBar() {
  const pathname = usePathname();
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const {
    staffList,
    setStaffList,
    selectedStaffId,
    selectedStaffIds,
    setSelectedStaffId,
    setSelectedStaffIds,
  } = useStaffModuleSelection();
  const positionTags = useStaffPositionTagsStorage(restaurantId);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [pickerFilters, setPickerFilters] = useState<StaffOverviewFilterState>(
    ARBEITSZEITEN_FILTER_DEFAULTS,
  );
  const showSkeleton = useDeferredSkeleton(loading);
  const barRef = useRef<HTMLDivElement>(null);
  useCssVarElementHeight(barRef, STAFF_MODULE_STICKY_BAR_H_VAR);

  const reloadStaffList = useCallback(async () => {
    if (!restaurantId) {
      setStaffList([]);
      return;
    }
    const { data } = await fetchStaffForRestaurant(restaurantId);
    setStaffList(data);
  }, [restaurantId, setStaffList]);

  useEffect(() => {
    if (!restaurantId) {
      setStaffList([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void (async () => {
      await reloadStaffList();
      setLoading(false);
    })();
  }, [restaurantId, reloadStaffList, setStaffList]);

  const activePositionTags = useMemo(
    () => positionTags.items.filter((t) => t.active),
    [positionTags.items],
  );

  const allowsMultiStaff = useMemo(() => {
    if (pathname.startsWith("/dashboard/mitarbeiter/vertraege")) return true;
    if (pathname.startsWith("/dashboard/mitarbeiter/dokumente")) return true;
    // Nur Kalender — Abrechnung/Beheben brauchen Einzelauswahl.
    return pathname === "/dashboard/mitarbeiter/arbeitszeiten";
  }, [pathname]);

  const includeInactiveStaff = pathname.startsWith(
    "/dashboard/mitarbeiter/arbeitszeiten",
  );
  const filterDay = includeInactiveStaff ? localDayKey(new Date()) : "";
  const { contracts } = useStaffListQuery(
    includeInactiveStaff ? restaurantId : null,
    workspaceReady,
  );
  const employmentTypes = useStaffEmploymentTypesStorage(
    includeInactiveStaff ? restaurantId : null,
  );
  const { workingIds, breakIds } = useStaffDayStatsQuery(
    includeInactiveStaff ? restaurantId : null,
    filterDay,
  );

  const activeEmploymentTypes = useMemo(
    () => employmentTypes.items.filter((t) => t.active),
    [employmentTypes.items],
  );

  const roleOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const row of staffList) {
      if (row.restaurant_position) {
        byId.set(row.restaurant_position.id, row.restaurant_position.name);
      }
    }
    const options = [...byId.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "de"));
    return [
      { value: "all", label: "Alle Rollen" },
      ...options,
      { value: "__none__", label: "Ohne Rolle" },
    ];
  }, [staffList]);

  const pickerStaff = useMemo(() => {
    if (!includeInactiveStaff) return staffList;
    const filtered = applyStaffOverviewFilters(
      staffList,
      pickerFilters,
      workingIds,
      breakIds,
      contracts,
      filterDay,
    );
    const seen = new Set(filtered.map((row) => row.id));
    const pinned = allowsMultiStaff ? selectedStaffIds : [selectedStaffId];
    const extra: RestaurantStaffRow[] = [];
    for (const id of pinned) {
      if (!id || seen.has(id)) continue;
      const row = staffList.find((item) => item.id === id);
      if (row) extra.push(row);
    }
    return extra.length > 0 ? [...filtered, ...extra] : filtered;
  }, [
    allowsMultiStaff,
    breakIds,
    contracts,
    filterDay,
    includeInactiveStaff,
    pickerFilters,
    selectedStaffId,
    selectedStaffIds,
    staffList,
    workingIds,
  ]);

  const activeFilterCount = includeInactiveStaff
    ? countStaffOverviewActiveFilters(pickerFilters, ARBEITSZEITEN_FILTER_DEFAULTS)
    : 0;

  const optionSource = includeInactiveStaff ? pickerStaff : staffList;

  const singleOptions = useMemo(
    () =>
      buildStaffModulePickerOptions(optionSource, {
        allowAll: false,
        activeOnly: !includeInactiveStaff,
        includeStaffIds: [selectedStaffId],
      }),
    [includeInactiveStaff, optionSource, selectedStaffId],
  );

  const multiOptions = useMemo(
    () =>
      buildStaffSearchableSelectOptions(optionSource, {
        activeOnly: !includeInactiveStaff,
        includeStaffIds: selectedStaffIds,
      }),
    [includeInactiveStaff, optionSource, selectedStaffIds],
  );

  const handleStaffSaved = useCallback(
    (staffId?: string) => {
      void (async () => {
        await reloadStaffList();
        if (staffId) {
          setSelectedStaffId(staffId);
        }
      })();
    },
    [reloadStaffList, setSelectedStaffId],
  );

  return (
    <>
      <div
        ref={barRef}
        className={cn(
          "sticky top-0 z-30 -mx-4 border-b border-border/50 bg-app-chrome px-4 py-1.5 sm:-mx-6 sm:px-6 sm:py-2",
          "transition-[padding] duration-200 ease-out",
          "supports-[backdrop-filter]:bg-app-chrome/95 supports-[backdrop-filter]:backdrop-blur",
        )}
      >
        <div className="flex w-full min-w-0 flex-col gap-0.5 sm:gap-1">
          <Label
            htmlFor="staff-module-select"
            className="sr-only text-xs text-muted-foreground sm:not-sr-only"
          >
            Mitarbeiter
          </Label>
          {loading && !showSkeleton ? (
            <div className="h-9 sm:h-11" aria-busy="true" />
          ) : null}
          {showSkeleton ? (
            <Skeleton
              aria-busy
              aria-label="Mitarbeiterliste wird geladen"
              className="h-9 w-full rounded-xl sm:h-11"
            />
          ) : allowsMultiStaff ? (
            <div className="flex min-w-0 items-start gap-2">
              <div className="min-w-0 flex-1">
                <SearchableMultiSelect
                  id="staff-module-select"
                  options={multiOptions}
                  value={selectedStaffIds}
                  onChange={setSelectedStaffIds}
                  placeholder="Alle Mitarbeiter"
                  searchPlaceholder="Suchen …"
                  emptyMessage="Keine Mitarbeiter"
                  aria-label="Mitarbeiter filtern"
                  className="!min-h-9 rounded-xl border-input transition-[min-height] duration-200 ease-out sm:!min-h-11"
                />
              </div>
              {includeInactiveStaff ? (
                <StaffPickerFilterButton
                  count={activeFilterCount}
                  onClick={() => setFilterOpen(true)}
                />
              ) : null}
              {restaurantId ? (
                <button
                  type="button"
                  className="inline-flex h-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-card px-2.5 text-xs font-medium text-accent hover:bg-muted/50 sm:h-11 sm:px-3 sm:text-sm"
                  onClick={() => setFormOpen(true)}
                >
                  Neu
                </button>
              ) : null}
            </div>
          ) : (
            <div className="flex min-w-0 items-start gap-2">
              <div className="min-w-0 flex-1">
                <SearchableSelect
                  id="staff-module-select"
                  options={singleOptions}
                  value={staffModulePickerSelectValue(selectedStaffId, false)}
                  onValueChange={(v) =>
                    setSelectedStaffId(
                      staffModulePickerIdFromSelectValue(v, false),
                    )
                  }
                  placeholder="Bitte Mitarbeiter auswählen"
                  searchPlaceholder="Suchen …"
                  emptyText="Keine Mitarbeiter"
                  className="!h-9 !min-h-9 rounded-xl border-input transition-[height,min-height] duration-200 ease-out sm:!h-11 sm:!min-h-11"
                  footerAction={
                    restaurantId
                      ? {
                          label: "Neuer Mitarbeiter",
                          onSelect: () => setFormOpen(true),
                        }
                      : undefined
                  }
                />
              </div>
              {includeInactiveStaff ? (
                <StaffPickerFilterButton
                  count={activeFilterCount}
                  onClick={() => setFilterOpen(true)}
                />
              ) : null}
            </div>
          )}
        </div>
      </div>

      {includeInactiveStaff ? (
        <StaffOverviewFilterDrawer
          open={filterOpen}
          onOpenChange={setFilterOpen}
          filters={pickerFilters}
          onFiltersChange={(patch) => {
            setPickerFilters((prev) => ({ ...prev, ...patch }));
          }}
          positionTags={activePositionTags}
          roleOptions={roleOptions}
          employmentTypes={activeEmploymentTypes}
          resetTo={ARBEITSZEITEN_FILTER_DEFAULTS}
        />
      ) : null}

      {restaurantId ? (
        <StaffFormDrawer
          open={formOpen}
          onOpenChange={setFormOpen}
          mode="create"
          restaurantId={restaurantId}
          staff={null}
          activePositionTags={activePositionTags}
          onSaved={handleStaffSaved}
        />
      ) : null}
    </>
  );
}

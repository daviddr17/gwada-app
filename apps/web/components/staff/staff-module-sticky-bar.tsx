"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { StaffFormDrawer } from "@/components/staff/staff-form-drawer";
import { SearchableSelect } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useStaffModuleSelection } from "@/lib/contexts/staff-module-selection-context";
import { buildStaffModulePickerOptions, staffModulePickerIdFromSelectValue, staffModulePickerSelectValue } from "@/lib/staff/staff-select-options";
import { useStaffPositionTagsStorage } from "@/lib/hooks/use-staff-position-tags-storage";
import { fetchStaffForRestaurant } from "@/lib/supabase/staff-db";
import { useCssVarElementHeight } from "@/lib/hooks/use-css-var-element-height";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { STAFF_MODULE_STICKY_BAR_H_VAR } from "@/lib/staff/staff-sticky-chrome";
import { cn } from "@/lib/utils";

export function StaffModuleStickyBar() {
  const pathname = usePathname();
  const { restaurantId } = useWorkspaceRestaurantUuid();
  const {
    staffList,
    setStaffList,
    selectedStaffId,
    setSelectedStaffId,
  } = useStaffModuleSelection();
  const positionTags = useStaffPositionTagsStorage(restaurantId);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
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

  const allowsAllStaff = useMemo(
    () =>
      pathname.startsWith("/dashboard/mitarbeiter/vertraege") ||
      pathname.startsWith("/dashboard/mitarbeiter/dokumente") ||
      pathname.startsWith("/dashboard/mitarbeiter/arbeitszeiten"),
    [pathname],
  );

  const options = useMemo(
    () =>
      buildStaffModulePickerOptions(staffList, {
        allowAll: allowsAllStaff,
        activeOnly: true,
        includeStaffIds: [selectedStaffId],
      }),
    [staffList, selectedStaffId, allowsAllStaff],
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

  const staffPickerPlaceholder = useMemo(() => {
    if (allowsAllStaff) {
      return "Alle Mitarbeiter";
    }
    return "Bitte Mitarbeiter auswählen";
  }, [allowsAllStaff]);

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
          ) : (
            <SearchableSelect
              id="staff-module-select"
              options={options}
              value={staffModulePickerSelectValue(selectedStaffId, allowsAllStaff)}
              onValueChange={(v) =>
                setSelectedStaffId(
                  staffModulePickerIdFromSelectValue(v, allowsAllStaff),
                )
              }
              placeholder={staffPickerPlaceholder}
              searchPlaceholder="Suchen …"
              emptyText="Keine Mitarbeiter"
              clearable={allowsAllStaff && Boolean(selectedStaffId)}
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
          )}
        </div>
      </div>

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

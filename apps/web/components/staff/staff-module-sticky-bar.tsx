"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { StaffFormDrawer } from "@/components/staff/staff-form-drawer";
import { SearchableSelect } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useStaffModuleSelection } from "@/lib/contexts/staff-module-selection-context";
import { buildStaffSearchableSelectOptions } from "@/lib/staff/staff-select-options";
import { useStaffPositionTagsStorage } from "@/lib/hooks/use-staff-position-tags-storage";
import { fetchStaffForRestaurant } from "@/lib/supabase/staff-db";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { cn } from "@/lib/utils";

export function StaffModuleStickyBar() {
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

  const options = useMemo(
    () =>
      buildStaffSearchableSelectOptions(staffList, {
        activeOnly: true,
        includeStaffIds: [selectedStaffId],
      }),
    [staffList, selectedStaffId],
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
        className={cn(
          "sticky top-0 z-30 -mx-4 border-b border-border/50 bg-app-chrome px-4 py-2 sm:-mx-6 sm:px-6",
          "supports-[backdrop-filter]:bg-app-chrome/95 supports-[backdrop-filter]:backdrop-blur",
        )}
      >
        <div className="flex w-full min-w-0 flex-col gap-1">
          <Label
            htmlFor="staff-module-select"
            className="text-xs text-muted-foreground"
          >
            Mitarbeiter
          </Label>
          {loading && !showSkeleton ? (
            <div className="h-11" aria-busy="true" />
          ) : null}
          {showSkeleton ? (
            <Skeleton
              aria-busy
              aria-label="Mitarbeiterliste wird geladen"
              className="h-11 w-full rounded-xl"
            />
          ) : (
            <SearchableSelect
              id="staff-module-select"
              options={options}
              value={selectedStaffId ?? ""}
              onValueChange={(v) => setSelectedStaffId(v || null)}
              placeholder="Mitarbeiter wählen …"
              searchPlaceholder="Suchen …"
              emptyText="Keine Mitarbeiter"
              className="!min-h-11 !h-11 rounded-xl border-input"
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

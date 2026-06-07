"use client";

import { useEffect, useState } from "react";
import { SearchableSelect } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  staffOptionLabel,
  useStaffModuleSelection,
} from "@/lib/contexts/staff-module-selection-context";
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
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading);

  useEffect(() => {
    if (!restaurantId) {
      setStaffList([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void (async () => {
      const { data } = await fetchStaffForRestaurant(restaurantId);
      setStaffList(data);
      setLoading(false);
    })();
  }, [restaurantId, setStaffList]);

  const options = staffList.map((s) => ({
    value: s.id,
    label: staffOptionLabel(s),
    leadingColor: s.position_tag?.background_color,
  }));

  return (
    <div
      className={cn(
        "sticky top-0 z-30 -mx-4 border-b border-border/50 bg-app-chrome px-4 py-2 sm:-mx-6 sm:px-6",
        "supports-[backdrop-filter]:bg-app-chrome/95 supports-[backdrop-filter]:backdrop-blur",
      )}
    >
      <div className="flex max-w-md flex-col gap-1">
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
          />
        )}
      </div>
    </div>
  );
}

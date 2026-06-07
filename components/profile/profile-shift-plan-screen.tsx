"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StaffShiftPlanScreen } from "@/components/staff/shift-plan/staff-shift-plan-screen";
import { StaffWorkHoursSkeleton } from "@/components/staff/staff-work-hours-skeleton";
import { ShiftPlanShiftCard } from "@/components/staff/shift-plan/shift-plan-shift-card";
import { useMyRestaurantStaff } from "@/lib/hooks/use-my-restaurant-staff";
import { useRestaurantProfile } from "@/lib/contexts/restaurant-profile-context";
import {
  fetchScheduledShiftsInRange,
  respondToScheduledShift,
} from "@/lib/supabase/staff-shift-schedule-db";
import type { RestaurantStaffScheduledShiftRow } from "@/lib/types/staff-shift-schedule";
import { viewRangeUtcIso } from "@/lib/staff/shift-schedule-range";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";

export function ProfileShiftPlanScreen() {
  const { profile } = useRestaurantProfile();
  const {
    restaurantId,
    workspaceReady,
    staffId,
    loading,
    showSkeleton,
  } = useMyRestaurantStaff();

  const [pendingShifts, setPendingShifts] = useState<
    RestaurantStaffScheduledShiftRow[]
  >([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadPending = useCallback(async () => {
    if (!restaurantId || !staffId) {
      setPendingShifts([]);
      return;
    }
    const range = viewRangeUtcIso(new Date(), "month");
    const { data, error } = await fetchScheduledShiftsInRange(
      restaurantId,
      range.rangeStart,
      range.rangeEnd,
      { staffId },
    );
    if (error) {
      toast.error(error);
      return;
    }
    setPendingShifts(data.filter((s) => s.status === "pending"));
  }, [restaurantId, staffId]);

  useEffect(() => {
    void loadPending();
  }, [loadPending, refreshKey]);

  const respond = async (id: string, accept: boolean) => {
    const { error } = await respondToScheduledShift(id, accept);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(accept ? "Schicht angenommen." : "Schicht abgelehnt.");
    setRefreshKey((k) => k + 1);
  };

  if (!workspaceReady) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;

  if (loading && !showSkeleton) {
    return <div className="min-h-[28rem]" aria-busy="true" />;
  }
  if (showSkeleton) return <StaffWorkHoursSkeleton />;

  if (!staffId) {
    const restaurantLabel = profile.name?.trim() || "diesem Restaurant";
    return (
      <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3.5 text-sm text-muted-foreground">
        Für{" "}
        <span className="font-medium text-foreground">{restaurantLabel}</span>{" "}
        bist du keinem Mitarbeiterprofil zugeordnet. Dein Dienstplan erscheint
        hier, sobald dein Konto verknüpft ist.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pendingShifts.length > 0 ? (
        <div className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/8 p-4">
          <p className="text-sm font-medium text-foreground">
            {pendingShifts.length} Schicht
            {pendingShifts.length === 1 ? "" : "en"} warten auf deine
            Bestätigung
          </p>
          <ul className="space-y-2">
            {pendingShifts.map((shift) => (
              <li
                key={shift.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border/50 bg-card p-3"
              >
                <div className="min-w-[12rem] flex-1">
                  <ShiftPlanShiftCard shift={shift} draggable={false} />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void respond(shift.id, false)}
                  >
                    Ablehnen
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void respond(shift.id, true)}
                  >
                    Annehmen
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <StaffShiftPlanScreen
        key={refreshKey}
        personalMode
        personalStaffId={staffId}
      />
    </div>
  );
}

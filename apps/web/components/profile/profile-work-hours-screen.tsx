"use client";

import { StaffWorkHoursSkeleton } from "@/components/staff/staff-work-hours-skeleton";
import { StaffWorkHoursView } from "@/components/staff/staff-work-hours-view";
import { useMyRestaurantStaff } from "@/lib/hooks/use-my-restaurant-staff";
import { useRestaurantProfile } from "@/lib/contexts/restaurant-profile-context";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";

export function ProfileWorkHoursScreen() {
  const { profile } = useRestaurantProfile();
  const {
    restaurantId,
    workspaceReady,
    staff,
    staffId,
    loading,
    showSkeleton,
  } = useMyRestaurantStaff();

  if (!workspaceReady) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;

  if (loading && !showSkeleton) {
    return <div className="min-h-[28rem]" aria-busy="true" />;
  }

  if (showSkeleton) {
    return <StaffWorkHoursSkeleton />;
  }

  if (!staff || !staffId) {
    const restaurantLabel = profile.name?.trim() || "diesem Restaurant";
    return (
      <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3.5 text-sm text-muted-foreground">
        Für{" "}
        <span className="font-medium text-foreground">{restaurantLabel}</span>{" "}
        bist du keinem Mitarbeiterprofil zugeordnet. Arbeitszeiten werden hier
        angezeigt, sobald dein Konto mit einem Mitarbeiter verknüpft ist.
      </div>
    );
  }

  return (
    <StaffWorkHoursView
      restaurantId={restaurantId}
      staff={staff}
      staffId={staffId}
    />
  );
}

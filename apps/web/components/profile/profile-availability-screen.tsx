"use client";

import { StaffAvailabilityEditor } from "@/components/staff/staff-availability-editor";
import { useMyRestaurantStaff } from "@/lib/hooks/use-my-restaurant-staff";
import { useRestaurantProfile } from "@/lib/contexts/restaurant-profile-context";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";

export function ProfileAvailabilityScreen() {
  const { profile } = useRestaurantProfile();
  const { restaurantId, workspaceReady, staff, staffId, loading } =
    useMyRestaurantStaff();

  if (!workspaceReady) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;

  if (loading) {
    return <div className="min-h-[20rem]" aria-busy="true" />;
  }

  if (!staff || !staffId) {
    const restaurantLabel = profile.name?.trim() || "diesem Restaurant";
    return (
      <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3.5 text-sm text-muted-foreground">
        Für{" "}
        <span className="font-medium text-foreground">{restaurantLabel}</span>{" "}
        bist du keinem Mitarbeiterprofil zugeordnet.
      </div>
    );
  }

  return (
    <StaffAvailabilityEditor restaurantId={restaurantId} staffId={staffId} />
  );
}

"use client";

import { StaffWorkHoursView } from "@/components/staff/staff-work-hours-view";
import { useStaffModuleSelection } from "@/lib/contexts/staff-module-selection-context";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { hasModuleUpdate } from "@/lib/permissions/module-crud-permissions";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";

export function StaffWorkHoursScreen() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const { has } = useRestaurantPermissions();
  const allowEdit = hasModuleUpdate(has, "staff");
  const { selectedStaff, selectedStaffId } = useStaffModuleSelection();

  if (!workspaceReady) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;

  return (
    <StaffWorkHoursView
      restaurantId={restaurantId}
      staff={selectedStaff}
      staffId={selectedStaffId}
      allowEdit={allowEdit}
    />
  );
}

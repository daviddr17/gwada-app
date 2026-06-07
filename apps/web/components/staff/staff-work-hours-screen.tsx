"use client";

import { StaffWorkHoursView } from "@/components/staff/staff-work-hours-view";
import { StaffSelectEmployeeHint } from "@/components/staff/staff-select-employee-hint";
import { useStaffModuleSelection } from "@/lib/contexts/staff-module-selection-context";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";

export function StaffWorkHoursScreen() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const { selectedStaff, selectedStaffId } = useStaffModuleSelection();

  if (!workspaceReady) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;
  if (!selectedStaff || !selectedStaffId) {
    return <StaffSelectEmployeeHint />;
  }

  return (
    <StaffWorkHoursView
      restaurantId={restaurantId}
      staff={selectedStaff}
      staffId={selectedStaffId}
    />
  );
}

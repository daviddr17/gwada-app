"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { visibleDashboardBatchWidgets } from "@/lib/dashboard/dashboard-batch-widgets";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { useDashboardWidgetPreferences } from "@/lib/hooks/use-dashboard-widget-preferences";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";

function isDashboardHomePath(pathname: string): boolean {
  const path =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  return path === "/dashboard";
}

/** Batch-Query nur auf der Dashboard-Home mit sichtbaren API-Widgets. */
export function useDashboardBatchQueryEnabled(): boolean {
  const pathname = usePathname();
  const { visibility } = useDashboardWidgetPreferences();
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();

  const widgets = useMemo(
    () => visibleDashboardBatchWidgets(visibility),
    [visibility],
  );

  return (
    isDashboardHomePath(pathname) &&
    workspaceReady &&
    Boolean(restaurantId && isUuidRestaurantId(restaurantId)) &&
    widgets.length > 0
  );
}

"use client";

import { usePathname } from "next/navigation";
import { useDashboardEffectiveWidgetPrefs } from "@/lib/hooks/use-dashboard-effective-widget-prefs";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";

function isDashboardHomePath(pathname: string): boolean {
  const path =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  return path === "/dashboard";
}

/** Batch-Query nur auf der Dashboard-Home mit sichtbaren API-Widgets (Prefs ∩ Berechtigungen). */
export function useDashboardBatchQueryEnabled(): boolean {
  const pathname = usePathname();
  const { batchWidgets } = useDashboardEffectiveWidgetPrefs();
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();

  return (
    isDashboardHomePath(pathname) &&
    workspaceReady &&
    Boolean(restaurantId && isUuidRestaurantId(restaurantId)) &&
    batchWidgets.length > 0
  );
}

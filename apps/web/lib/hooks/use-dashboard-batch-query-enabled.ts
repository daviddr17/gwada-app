"use client";

import { usePathname } from "next/navigation";
import { useDashboardHomeKeepAliveOptional } from "@/lib/contexts/module-home-keep-alive-context";
import { useDashboardEffectiveWidgetPrefs } from "@/lib/hooks/use-dashboard-effective-widget-prefs";
import { isDashboardHomePath } from "@/lib/navigation/dashboard-home-path";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";

/**
 * Batch-Query nur auf der echten Dashboard-Home-URL (Prefetch/Refetch).
 * Keep-alive liest Cache weiter über {@link useDashboardBatchSlice} (`warm`).
 */
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

/**
 * Warm Keep-alive: Batch-Slice/Cache nutzen, kein Standalone-Fetch im Versteckten.
 */
export function useDashboardHomeBatchSurface(): boolean {
  const batchEnabled = useDashboardBatchQueryEnabled();
  const keepAlive = useDashboardHomeKeepAliveOptional();
  return batchEnabled || Boolean(keepAlive?.warm);
}

"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { dashboardBatchSummaryQueryOptions } from "@/lib/hooks/dashboard-batch-summary-query-options";
import { useDashboardEffectiveWidgetPrefs } from "@/lib/hooks/use-dashboard-effective-widget-prefs";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { runWhenIdle } from "@/lib/ui/run-when-idle";

/**
 * Lädt Dashboard-KPIs im Hintergrund, sobald Workspace-Restaurant steht —
 * bevor der Nutzer die Startseite öffnet (SWR, kein Skeleton auf erstem Besuch).
 */
export function DashboardBatchPrefetchMount() {
  const queryClient = useQueryClient();
  const { batchWidgets } = useDashboardEffectiveWidgetPrefs();
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();

  useEffect(() => {
    if (
      !workspaceReady ||
      !restaurantId ||
      !isUuidRestaurantId(restaurantId) ||
      batchWidgets.length === 0
    ) {
      return;
    }

    runWhenIdle(() => {
      void queryClient.prefetchQuery(
        dashboardBatchSummaryQueryOptions(restaurantId, batchWidgets),
      );
    });
  }, [queryClient, restaurantId, batchWidgets, workspaceReady]);

  return null;
}

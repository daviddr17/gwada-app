"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { peekDashboardBatchSummaryCache } from "@/lib/dashboard/dashboard-batch-summary-cache";
import { dashboardBatchSummaryQueryOptions } from "@/lib/hooks/dashboard-batch-summary-query-options";
import { useDashboardEffectiveWidgetPrefs } from "@/lib/hooks/use-dashboard-effective-widget-prefs";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { queryKeys } from "@/lib/query/query-keys";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { runWhenIdle } from "@/lib/ui/run-when-idle";

/**
 * Seedet Dashboard-KPIs sofort aus LS und zieht im Hintergrund frisch —
 * bevor / sobald der Nutzer die Startseite öffnet (kein 8s-Idle mehr).
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

    const key = queryKeys.dashboard.summary(restaurantId, batchWidgets);
    const hadMemory = queryClient.getQueryData(key) != null;
    let hadLs = false;
    if (!hadMemory) {
      const cached = peekDashboardBatchSummaryCache(restaurantId, batchWidgets);
      if (cached) {
        hadLs = true;
        queryClient.setQueryData(key, cached);
      }
    }

    // Cold: sofort prefetchen. Warm (LS/Memory): kurz idle, UI-Klicks zuerst.
    const prefetch = () => {
      void queryClient.prefetchQuery(
        dashboardBatchSummaryQueryOptions(restaurantId, batchWidgets),
      );
    };
    if (hadMemory || hadLs) {
      runWhenIdle(prefetch, 400);
    } else {
      prefetch();
    }
  }, [queryClient, restaurantId, batchWidgets, workspaceReady]);

  return null;
}

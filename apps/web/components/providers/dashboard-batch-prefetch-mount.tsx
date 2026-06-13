"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { visibleDashboardBatchWidgets } from "@/lib/dashboard/dashboard-batch-widgets";
import { dashboardBatchSummaryQueryOptions } from "@/lib/hooks/dashboard-batch-summary-query-options";
import { useDashboardWidgetPreferences } from "@/lib/hooks/use-dashboard-widget-preferences";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

/**
 * Lädt Dashboard-KPIs im Hintergrund, sobald Workspace-Restaurant steht —
 * bevor der Nutzer die Startseite öffnet (SWR, kein Skeleton auf erstem Besuch).
 */
export function DashboardBatchPrefetchMount() {
  const queryClient = useQueryClient();
  const { visibility } = useDashboardWidgetPreferences();
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();

  const widgets = useMemo(
    () => visibleDashboardBatchWidgets(visibility),
    [visibility],
  );

  useEffect(() => {
    if (
      !workspaceReady ||
      !restaurantId ||
      !isUuidRestaurantId(restaurantId) ||
      widgets.length === 0
    ) {
      return;
    }

    void queryClient.prefetchQuery(
      dashboardBatchSummaryQueryOptions(restaurantId, widgets),
    );
  }, [queryClient, restaurantId, widgets, workspaceReady]);

  return null;
}

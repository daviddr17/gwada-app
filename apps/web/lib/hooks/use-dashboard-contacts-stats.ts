"use client";

import { useCallback } from "react";
import type { DashboardContactsSummary } from "@/lib/contacts/compute-dashboard-contacts-summary";
import { fetchDashboardSummaryClient } from "@/lib/dashboard/fetch-dashboard-summary-client";
import { useDashboardBatchQueryEnabled } from "@/lib/hooks/use-dashboard-batch-query-enabled";
import { useDashboardBatchSlice } from "@/lib/hooks/use-dashboard-batch-slice";
import { useDashboardSummaryQuery } from "@/lib/hooks/use-dashboard-summary-query";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";

export function useDashboardContactsStats() {
  const batchEnabled = useDashboardBatchQueryEnabled();
  const batchSlice = useDashboardBatchSlice("contacts");
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();

  const fetch = useCallback(
    (id: string) =>
      fetchDashboardSummaryClient<DashboardContactsSummary>(
        "/api/dashboard/contacts/summary",
        id,
      ),
    [],
  );

  const standalone = useDashboardSummaryQuery({
    restaurantId,
    workspaceReady,
    fetch,
    enabled: !batchEnabled,
  });

  if (batchEnabled) {
    return batchSlice;
  }

  return standalone;
}

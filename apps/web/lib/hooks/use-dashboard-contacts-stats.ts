"use client";

import { useCallback } from "react";
import type { DashboardContactsSummary } from "@/lib/contacts/compute-dashboard-contacts-summary";
import { fetchDashboardSummaryClient } from "@/lib/dashboard/fetch-dashboard-summary-client";
import { useDashboardSummaryQuery } from "@/lib/hooks/use-dashboard-summary-query";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";

export function useDashboardContactsStats() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();

  const fetch = useCallback(
    (id: string) =>
      fetchDashboardSummaryClient<DashboardContactsSummary>(
        "/api/dashboard/contacts/summary",
        id,
      ),
    [],
  );

  return useDashboardSummaryQuery({
    restaurantId,
    workspaceReady,
    fetch,
  });
}

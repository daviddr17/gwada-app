"use client";

import { useCallback } from "react";
import type { DashboardReservationSummary } from "@/lib/reservations/compute-dashboard-reservation-summary";
import { fetchDashboardSummaryClient } from "@/lib/dashboard/fetch-dashboard-summary-client";
import { GWADA_DASHBOARD_RESERVATIONS_REFRESH_EVENT } from "@/lib/dashboard/dashboard-live-events";
import { useDashboardBatchQueryEnabled } from "@/lib/hooks/use-dashboard-batch-query-enabled";
import { useDashboardBatchSlice } from "@/lib/hooks/use-dashboard-batch-slice";
import { useDashboardSummaryQuery } from "@/lib/hooks/use-dashboard-summary-query";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";

const RESERVATION_DASHBOARD_REFRESH_EVENTS = [
  GWADA_DASHBOARD_RESERVATIONS_REFRESH_EVENT,
] as const;

export function useDashboardReservationStats() {
  const batchEnabled = useDashboardBatchQueryEnabled();
  const batchSlice = useDashboardBatchSlice("reservations");
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();

  const fetch = useCallback(
    (id: string) =>
      fetchDashboardSummaryClient<DashboardReservationSummary>(
        "/api/dashboard/reservations/summary",
        id,
      ),
    [],
  );

  const standalone = useDashboardSummaryQuery({
    restaurantId,
    workspaceReady,
    fetch,
    extraRefreshEvents: RESERVATION_DASHBOARD_REFRESH_EVENTS,
    enabled: !batchEnabled,
  });

  if (batchEnabled) {
    return batchSlice;
  }

  return standalone;
}

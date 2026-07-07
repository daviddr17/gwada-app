"use client";

import { useCallback, useMemo } from "react";
import type { DashboardReservationSummary } from "@/lib/reservations/compute-dashboard-reservation-summary";
import { patchDashboardReservationSummaryResolvedOpen } from "@/lib/dashboard/patch-dashboard-reservations-live-client";
import { fetchDashboardSummaryClient } from "@/lib/dashboard/fetch-dashboard-summary-client";
import { GWADA_DASHBOARD_RESERVATIONS_REFRESH_EVENT } from "@/lib/dashboard/dashboard-live-events";
import { useDashboardBatchQueryEnabled } from "@/lib/hooks/use-dashboard-batch-query-enabled";
import { useDashboardBatchSlice } from "@/lib/hooks/use-dashboard-batch-slice";
import { useDashboardSummaryQuery } from "@/lib/hooks/use-dashboard-summary-query";
import {
  GWADA_RESERVATION_OPEN_RESOLVED_EVENT,
  type ReservationOpenResolvedDetail,
  shouldDecrementUnconfirmedCount,
} from "@/lib/reservations/reservation-open-status";
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

  const optimisticPatches = useMemo(
    () => [
      {
        event: GWADA_RESERVATION_OPEN_RESOLVED_EVENT,
        patch: (prev: DashboardReservationSummary, detail: unknown) => {
          const d = detail as ReservationOpenResolvedDetail;
          if (
            !shouldDecrementUnconfirmedCount({
              previousStatusCode: d.previousStatusCode,
              nextStatusCode: d.nextStatusCode,
            })
          ) {
            return prev;
          }
          return patchDashboardReservationSummaryResolvedOpen(
            prev,
            d.reservationId,
          );
        },
      },
    ],
    [],
  );

  const standalone = useDashboardSummaryQuery({
    restaurantId,
    workspaceReady,
    fetch,
    extraRefreshEvents: RESERVATION_DASHBOARD_REFRESH_EVENTS,
    optimisticPatches,
    enabled: !batchEnabled,
  });

  if (batchEnabled) {
    return batchSlice;
  }

  return standalone;
}

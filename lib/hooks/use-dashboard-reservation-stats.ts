"use client";

import { useEffect, useState } from "react";
import type { DashboardReservationSummary } from "@/lib/reservations/compute-dashboard-reservation-summary";
import { fetchDashboardSummaryClient } from "@/lib/dashboard/fetch-dashboard-summary-client";
import { GWADA_DASHBOARD_RESERVATIONS_REFRESH_EVENT } from "@/lib/dashboard/dashboard-live-events";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT } from "@/lib/supabase/workspace-persistence";

export function useDashboardReservationStats() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const [summary, setSummary] = useState<DashboardReservationSummary | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId || !isUuidRestaurantId(restaurantId)) {
      setSummary(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancel = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      const { data, error: err } =
        await fetchDashboardSummaryClient<DashboardReservationSummary>(
          "/api/dashboard/reservations/summary",
          restaurantId,
        );
      if (cancel) return;
      setLoading(false);
      setSummary(data);
      setError(err);
    };

    void run();

    const onRefresh = () => void run();
    window.addEventListener(
      GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT,
      onRefresh,
    );
    window.addEventListener(
      GWADA_DASHBOARD_RESERVATIONS_REFRESH_EVENT,
      onRefresh,
    );
    return () => {
      cancel = true;
      window.removeEventListener(
        GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT,
        onRefresh,
      );
      window.removeEventListener(
        GWADA_DASHBOARD_RESERVATIONS_REFRESH_EVENT,
        onRefresh,
      );
    };
  }, [restaurantId]);

  return {
    summary,
    loading,
    error,
    ready: workspaceReady && Boolean(restaurantId && isUuidRestaurantId(restaurantId)),
  };
}

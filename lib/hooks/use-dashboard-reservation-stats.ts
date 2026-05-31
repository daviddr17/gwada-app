"use client";

import { useEffect, useState } from "react";
import type { DashboardReservationSummary } from "@/lib/reservations/compute-dashboard-reservation-summary";
import { loadDashboardReservationSummary } from "@/lib/reservations/load-dashboard-reservation-summary";
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
      const { summary: next, error: err } =
        await loadDashboardReservationSummary(restaurantId);
      if (cancel) return;
      setLoading(false);
      setSummary(next);
      setError(err?.message ?? null);
    };

    void run();

    const onRestaurantChange = () => void run();
    window.addEventListener(
      GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT,
      onRestaurantChange,
    );
    return () => {
      cancel = true;
      window.removeEventListener(
        GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT,
        onRestaurantChange,
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

"use client";

import { useEffect, useState } from "react";
import type { DashboardContactsSummary } from "@/lib/contacts/compute-dashboard-contacts-summary";
import { fetchDashboardSummaryClient } from "@/lib/dashboard/fetch-dashboard-summary-client";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT } from "@/lib/supabase/workspace-persistence";

export function useDashboardContactsStats() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const [summary, setSummary] = useState<DashboardContactsSummary | null>(null);
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
        await fetchDashboardSummaryClient<DashboardContactsSummary>(
          "/api/dashboard/contacts/summary",
          restaurantId,
        );
      if (cancel) return;
      setLoading(false);
      if (err) {
        setSummary(null);
        setError(err);
        return;
      }
      setSummary(data);
    };

    void run();

    const onChange = () => void run();
    window.addEventListener(GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT, onChange);
    return () => {
      cancel = true;
      window.removeEventListener(GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT, onChange);
    };
  }, [restaurantId]);

  return {
    summary,
    loading,
    error,
    ready: workspaceReady && Boolean(restaurantId && isUuidRestaurantId(restaurantId)),
  };
}

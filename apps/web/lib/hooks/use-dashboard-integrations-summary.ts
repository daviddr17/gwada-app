"use client";

import { useCallback, useEffect, useState } from "react";
import type { DashboardIntegrationsSummary } from "@/lib/dashboard/dashboard-integration-channels";
import {
  GWADA_DASHBOARD_WIDGETS_REFRESH_EVENT,
  useDashboardHasDataRef,
} from "@/lib/dashboard/dashboard-widget-refresh";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT } from "@/lib/supabase/workspace-persistence";

export function useDashboardIntegrationsSummary() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const hasDataRef = useDashboardHasDataRef();
  const [summary, setSummary] = useState<DashboardIntegrationsSummary | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (silent: boolean) => {
      if (!restaurantId || !isUuidRestaurantId(restaurantId)) return;

      const initial = !hasDataRef.current;
      if (!silent && initial) setLoading(true);
      if (!silent) setError(null);

      try {
        const res = await fetch(
          `/api/dashboard/integrations?${new URLSearchParams({ restaurantId })}`,
          { cache: "no-store", credentials: "include" },
        );
        const body = (await res.json()) as {
          data?: DashboardIntegrationsSummary;
          error?: string;
        };

        if (!res.ok) {
          if (!hasDataRef.current) {
            setSummary(null);
            setError(body.error ?? `http_${res.status}`);
          }
          if (!silent && initial) setLoading(false);
          return;
        }

        setSummary(
          body.data ?? { items: [], connectedCount: 0, totalCount: 0 },
        );
        hasDataRef.current = true;
        if (!silent && initial) setLoading(false);
      } catch {
        if (!hasDataRef.current) {
          setSummary(null);
          setError("network_error");
        }
        if (!silent && initial) setLoading(false);
      }
    },
    [restaurantId, hasDataRef],
  );

  useEffect(() => {
    if (!restaurantId || !isUuidRestaurantId(restaurantId)) {
      hasDataRef.current = false;
      setSummary(null);
      setError(null);
      setLoading(false);
      return;
    }

    hasDataRef.current = false;
    void run(false);

    const onPoll = () => void run(true);
    const onRestaurantChange = () => {
      hasDataRef.current = false;
      void run(false);
    };

    window.addEventListener(GWADA_DASHBOARD_WIDGETS_REFRESH_EVENT, onPoll);
    window.addEventListener(
      GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT,
      onRestaurantChange,
    );

    return () => {
      window.removeEventListener(GWADA_DASHBOARD_WIDGETS_REFRESH_EVENT, onPoll);
      window.removeEventListener(
        GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT,
        onRestaurantChange,
      );
    };
  }, [restaurantId, run, hasDataRef]);

  return {
    summary,
    loading,
    error,
    ready:
      workspaceReady &&
      Boolean(restaurantId && isUuidRestaurantId(restaurantId)),
  };
}

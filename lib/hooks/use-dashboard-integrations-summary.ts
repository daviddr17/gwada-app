"use client";

import { useCallback, useEffect, useState } from "react";
import type { DashboardIntegrationsSummary } from "@/lib/dashboard/dashboard-integration-channels";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT } from "@/lib/supabase/workspace-persistence";

export function useDashboardIntegrationsSummary() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const [summary, setSummary] = useState<DashboardIntegrationsSummary | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!restaurantId || !isUuidRestaurantId(restaurantId)) {
      setSummary(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/dashboard/integrations?${new URLSearchParams({ restaurantId })}`,
        { cache: "no-store" },
      );
      const body = (await res.json()) as {
        data?: DashboardIntegrationsSummary;
        error?: string;
      };
      setLoading(false);
      if (!res.ok) {
        setSummary(null);
        setError(body.error ?? `http_${res.status}`);
        return;
      }
      setSummary(
        body.data ?? { items: [], connectedCount: 0, totalCount: 0 },
      );
    } catch {
      setLoading(false);
      setSummary(null);
      setError("network_error");
    }
  }, [restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  useEffect(() => {
    const onChange = () => void load();
    window.addEventListener(GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT, onChange);
    return () => {
      window.removeEventListener(
        GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT,
        onChange,
      );
    };
  }, [load]);

  return {
    summary,
    loading,
    error,
    ready:
      workspaceReady &&
      Boolean(restaurantId && isUuidRestaurantId(restaurantId)),
  };
}

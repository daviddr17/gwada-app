"use client";

import { useEffect, useState } from "react";
import type { DashboardReviewsSummary } from "@/lib/dashboard/load-dashboard-reviews-summary";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT } from "@/lib/supabase/workspace-persistence";

export function useDashboardReviewsStats() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const [summary, setSummary] = useState<DashboardReviewsSummary | null>(null);
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
      try {
        const res = await fetch(
          `/api/dashboard/reviews?${new URLSearchParams({ restaurantId })}`,
        );
        const json = (await res.json()) as {
          data?: DashboardReviewsSummary;
          error?: string;
        };
        if (cancel) return;
        if (!res.ok) {
          setSummary(null);
          setError(json.error ?? "Bewertungen konnten nicht geladen werden.");
          return;
        }
        setSummary(json.data ?? null);
      } catch {
        if (!cancel) {
          setSummary(null);
          setError("Netzwerkfehler.");
        }
      } finally {
        if (!cancel) setLoading(false);
      }
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

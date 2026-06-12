"use client";

import { useCallback } from "react";
import type { DashboardReviewsSummary } from "@/lib/dashboard/load-dashboard-reviews-summary";
import { useDashboardBatchQueryEnabled } from "@/lib/hooks/use-dashboard-batch-query-enabled";
import { useDashboardBatchSlice } from "@/lib/hooks/use-dashboard-batch-slice";
import { useDashboardSummaryQuery } from "@/lib/hooks/use-dashboard-summary-query";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";

export function useDashboardReviewsStats() {
  const batchEnabled = useDashboardBatchQueryEnabled();
  const batchSlice = useDashboardBatchSlice("reviews");
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();

  const loadReviews = useCallback(async (id: string) => {
    try {
      const res = await globalThis.fetch(
        `/api/dashboard/reviews?${new URLSearchParams({ restaurantId: id })}`,
        { cache: "no-store", credentials: "include" },
      );
      const json = (await res.json()) as {
        data?: DashboardReviewsSummary;
        error?: string;
      };
      if (!res.ok) {
        return {
          data: null,
          error: json.error ?? "Bewertungen konnten nicht geladen werden.",
        };
      }
      return { data: json.data ?? null, error: null };
    } catch {
      return { data: null, error: "network_error" };
    }
  }, []);

  const standalone = useDashboardSummaryQuery({
    restaurantId,
    workspaceReady,
    fetch: loadReviews,
    enabled: !batchEnabled,
  });

  if (batchEnabled) {
    return batchSlice;
  }

  return standalone;
}

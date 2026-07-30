"use client";

import { deriveMessagesUnreadSummaryFromConversations } from "@/lib/contact-messages/messages-unread-summary";
import { peekUnifiedInboxCache } from "@/lib/contact-messages/unified-inbox-cache";
import type { DashboardBatchWidgetId } from "@/lib/dashboard/dashboard-batch-widgets";
import {
  peekDashboardBatchSummaryCache,
  writeDashboardBatchSummaryCache,
} from "@/lib/dashboard/dashboard-batch-summary-cache";
import { fetchDashboardBatchSummaryClient } from "@/lib/dashboard/fetch-dashboard-batch-summary-client";
import {
  DASHBOARD_SUMMARY_GC_MS,
  DASHBOARD_SUMMARY_REFETCH_MS,
  DASHBOARD_SUMMARY_STALE_MS,
} from "@/lib/query/dashboard-query-policy";
import { queryKeys } from "@/lib/query/query-keys";
import type { DashboardBatchQueryData } from "@/lib/hooks/use-dashboard-batch-summary-query";

export async function fetchDashboardBatchQueryData(
  restaurantId: string,
  widgets: readonly DashboardBatchWidgetId[],
): Promise<DashboardBatchQueryData> {
  const result = await fetchDashboardBatchSummaryClient(restaurantId, widgets);
  if (result.error && !result.data) {
    throw new Error(result.error);
  }
  const payload: DashboardBatchQueryData = {
    data: result.data ?? {},
    errors: result.errors,
  };
  writeDashboardBatchSummaryCache(restaurantId, widgets, payload);
  return payload;
}

function batchSummaryWithMessagesFromInboxCache(
  payload: DashboardBatchQueryData,
  restaurantId: string,
): DashboardBatchQueryData {
  const conversations = peekUnifiedInboxCache(restaurantId);
  if (!conversations || !payload.data.messages) return payload;
  return {
    ...payload,
    data: {
      ...payload.data,
      messages: deriveMessagesUnreadSummaryFromConversations(conversations),
    },
  };
}

export function dashboardBatchSummaryQueryOptions(
  restaurantId: string,
  widgets: readonly DashboardBatchWidgetId[],
) {
  return {
    queryKey: queryKeys.dashboard.summary(restaurantId, widgets),
    queryFn: async (): Promise<DashboardBatchQueryData> => {
      const payload = await fetchDashboardBatchQueryData(restaurantId, widgets);
      const reconciled = batchSummaryWithMessagesFromInboxCache(
        payload,
        restaurantId,
      );
      if (reconciled !== payload) {
        writeDashboardBatchSummaryCache(restaurantId, widgets, reconciled);
      }
      return reconciled;
    },
    staleTime: DASHBOARD_SUMMARY_STALE_MS,
    gcTime: DASHBOARD_SUMMARY_GC_MS,
    /**
     * Kein Focus-Refetch: Batch ist teuer und blockiert sonst Klicks nach Tab-Idle.
     * Frische kommt über refetchInterval (sichtbarer Tab), Realtime-Patches und Invalidierung.
     */
    refetchOnWindowFocus: false as const,
    refetchInterval: () =>
      typeof document !== "undefined" &&
      document.visibilityState === "visible"
        ? DASHBOARD_SUMMARY_REFETCH_MS
        : false,
    refetchIntervalInBackground: false as const,
    placeholderData: (
      previousData: DashboardBatchQueryData | undefined,
    ): DashboardBatchQueryData | undefined => {
      const base =
        previousData ??
        peekDashboardBatchSummaryCache(restaurantId, widgets) ??
        undefined;
      if (!base) return undefined;
      return batchSummaryWithMessagesFromInboxCache(base, restaurantId);
    },
  };
}

"use client";

import { deriveMessagesUnreadSummaryFromConversations } from "@/lib/contact-messages/messages-unread-summary";
import { peekCompleteUnifiedInboxCache } from "@/lib/contact-messages/unified-inbox-cache";
import type { DashboardBatchWidgetId } from "@/lib/dashboard/dashboard-batch-widgets";
import {
  peekDashboardBatchSummaryCache,
  writeDashboardBatchSummaryCache,
} from "@/lib/dashboard/dashboard-batch-summary-cache";
import { notifyDashboardFirstKpiReady } from "@/lib/dashboard/dashboard-first-kpi-ready";
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
  options?: {
    persistCache?: boolean;
    onPartial?: (partial: DashboardBatchQueryData) => void;
  },
): Promise<DashboardBatchQueryData> {
  const result = await fetchDashboardBatchSummaryClient(restaurantId, widgets, {
    stream: Boolean(options?.onPartial),
    onPartial: options?.onPartial
      ? (partial) => {
          options.onPartial?.({
            data: partial.data,
            errors: partial.errors,
          });
        }
      : undefined,
  });
  if (result.error && !result.data) {
    throw new Error(result.error);
  }
  const payload: DashboardBatchQueryData = {
    data: result.data ?? {},
    errors: result.errors,
  };
  if (options?.persistCache !== false) {
    writeDashboardBatchSummaryCache(restaurantId, widgets, payload);
  }
  return payload;
}

function batchSummaryWithMessagesFromInboxCache(
  payload: DashboardBatchQueryData,
  restaurantId: string,
): DashboardBatchQueryData {
  const conversations = peekCompleteUnifiedInboxCache(restaurantId);
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
    queryFn: async (ctx: {
      client: {
        getQueryData: (
          key: readonly unknown[],
        ) => DashboardBatchQueryData | undefined;
        setQueryData: (
          key: readonly unknown[],
          data: DashboardBatchQueryData,
        ) => void;
      };
    }): Promise<DashboardBatchQueryData> => {
      const { client } = ctx;
      const queryKey = queryKeys.dashboard.summary(restaurantId, widgets);
      let firstKpiNotified = false;

      const publish = (payload: DashboardBatchQueryData): DashboardBatchQueryData => {
        const existing = client.getQueryData(queryKey);
        const merged: DashboardBatchQueryData = {
          data: { ...(existing?.data ?? {}), ...payload.data },
          errors: { ...(existing?.errors ?? {}), ...payload.errors },
        };
        const reconciled = batchSummaryWithMessagesFromInboxCache(
          merged,
          restaurantId,
        );
        client.setQueryData(queryKey, reconciled);
        writeDashboardBatchSummaryCache(restaurantId, widgets, reconciled);
        if (!firstKpiNotified && Object.keys(reconciled.data).length > 0) {
          firstKpiNotified = true;
          notifyDashboardFirstKpiReady(restaurantId);
        }
        return reconciled;
      };

      // NDJSON: jedes Widget paintet sofort — wie „Apps in 1s“, nicht erst am Batch-Ende.
      const payload = await fetchDashboardBatchQueryData(restaurantId, widgets, {
        persistCache: false,
        onPartial: (partial) => {
          publish(partial);
        },
      });
      return publish(payload);
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

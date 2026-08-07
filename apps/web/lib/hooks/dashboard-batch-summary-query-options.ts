"use client";

import { deriveMessagesUnreadSummaryFromConversations } from "@/lib/contact-messages/messages-unread-summary";
import { peekUnifiedInboxCache } from "@/lib/contact-messages/unified-inbox-cache";
import type { DashboardBatchWidgetId } from "@/lib/dashboard/dashboard-batch-widgets";
import {
  peekDashboardBatchSummaryCache,
  writeDashboardBatchSummaryCache,
} from "@/lib/dashboard/dashboard-batch-summary-cache";
import {
  mergeDashboardBatchQueryData,
  partitionDashboardBatchWidgets,
} from "@/lib/dashboard/dashboard-batch-priority";
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
  options?: { persistCache?: boolean },
): Promise<DashboardBatchQueryData> {
  const result = await fetchDashboardBatchSummaryClient(restaurantId, widgets);
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

function withDeferredPlaceholders(
  partial: DashboardBatchQueryData,
  restaurantId: string,
  fullWidgets: readonly DashboardBatchWidgetId[],
  deferred: readonly DashboardBatchWidgetId[],
): DashboardBatchQueryData {
  if (deferred.length === 0) return partial;
  const cached = peekDashboardBatchSummaryCache(restaurantId, fullWidgets);
  if (!cached) return partial;

  const data = { ...partial.data };
  for (const id of deferred) {
    if (data[id] == null && cached.data[id] != null) {
      Object.assign(data, { [id]: cached.data[id] });
    }
  }
  return { data, errors: partial.errors };
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
      const { priority, deferred } = partitionDashboardBatchWidgets(widgets);
      const queryKey = queryKeys.dashboard.summary(restaurantId, widgets);

      const finalize = (payload: DashboardBatchQueryData): DashboardBatchQueryData => {
        const reconciled = batchSummaryWithMessagesFromInboxCache(
          payload,
          restaurantId,
        );
        writeDashboardBatchSummaryCache(restaurantId, widgets, reconciled);
        return reconciled;
      };

      // Ein Phasen-Request, wenn nichts zu staffeln ist.
      if (priority.length === 0 || deferred.length === 0) {
        const payload = await fetchDashboardBatchQueryData(restaurantId, widgets, {
          persistCache: false,
        });
        return finalize(payload);
      }

      // Phase 1: Heute-kritische KPIs → UI sofort aktualisieren.
      const priorityPayload = await fetchDashboardBatchQueryData(
        restaurantId,
        priority,
        { persistCache: false },
      );
      const existing = client.getQueryData(queryKey);
      const phase1Base = mergeDashboardBatchQueryData(
        { data: existing?.data ?? {}, errors: existing?.errors ?? {} },
        priorityPayload,
      );
      const phase1 = finalize(
        withDeferredPlaceholders(phase1Base, restaurantId, widgets, deferred),
      );
      client.setQueryData(queryKey, phase1);

      // Phase 2: restliche Kacheln (Menü, News, …).
      const deferredPayload = await fetchDashboardBatchQueryData(
        restaurantId,
        deferred,
        { persistCache: false },
      );
      return finalize(mergeDashboardBatchQueryData(phase1, deferredPayload));
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

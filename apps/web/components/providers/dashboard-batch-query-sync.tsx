"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import {
  deriveMessagesUnreadSummaryFromConversations,
} from "@/lib/contact-messages/messages-unread-summary";
import {
  GWADA_UNIFIED_INBOX_CACHE_UPDATED_EVENT,
  peekUnifiedInboxCache,
} from "@/lib/contact-messages/unified-inbox-cache";
import { markDashboardBatchMessagesFetched } from "@/lib/dashboard/dashboard-batch-warm-coordinator";
import { clearDashboardBatchSummaryCache, writeDashboardBatchSummaryCache } from "@/lib/dashboard/dashboard-batch-summary-cache";
import { visibleDashboardBatchWidgets } from "@/lib/dashboard/dashboard-batch-widgets";
import {
  GWADA_DASHBOARD_MESSAGES_REFRESH_EVENT,
  type DashboardMessagesRefreshDetail,
  GWADA_DASHBOARD_RESERVATIONS_REFRESH_EVENT,
} from "@/lib/dashboard/dashboard-live-events";
import { patchMessagesUnreadSummary } from "@/lib/dashboard/patch-dashboard-messages-read-client";
import type { DashboardBatchQueryData } from "@/lib/hooks/use-dashboard-batch-summary-query";
import { useDashboardBatchQueryEnabled } from "@/lib/hooks/use-dashboard-batch-query-enabled";
import { useDashboardBatchSummaryQuery } from "@/lib/hooks/use-dashboard-batch-summary-query";
import { useDashboardWidgetPreferences } from "@/lib/hooks/use-dashboard-widget-preferences";
import { GWADA_STAFF_DATA_REFRESH_EVENT } from "@/lib/staff/staff-live-events";
import { queryKeys } from "@/lib/query/query-keys";
import { GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT } from "@/lib/supabase/workspace-persistence";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";

/**
 * Realtime / Workspace-Events → React-Query invalidate oder Messages patchen.
 * Hält Dashboard-KPIs live ohne langes staleTime.
 */
export function DashboardBatchQuerySync() {
  const queryClient = useQueryClient();
  const enabled = useDashboardBatchQueryEnabled();
  const { restaurantId } = useWorkspaceRestaurantUuid();
  const { visibility } = useDashboardWidgetPreferences();
  const { data: batchData } = useDashboardBatchSummaryQuery();
  const widgets = useMemo(
    () => visibleDashboardBatchWidgets(visibility),
    [visibility],
  );

  useEffect(() => {
    if (!restaurantId || !visibility.messages || !batchData?.data?.messages) {
      return;
    }
    markDashboardBatchMessagesFetched(restaurantId);
  }, [batchData, restaurantId, visibility.messages]);

  useEffect(() => {
    if (!enabled || !restaurantId) return;

    const summaryKey = queryKeys.dashboard.summary(restaurantId, widgets);

    const invalidateBatch = () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.summaryRoot(restaurantId),
      });
    };

    const patchMessagesFromReadDetail = (detail: DashboardMessagesRefreshDetail) => {
      if (detail.restaurantId !== restaurantId) return false;
      if (!detail.all && !detail.contactId) return false;

      queryClient.setQueryData<DashboardBatchQueryData>(summaryKey, (old) => {
        if (!old?.data?.messages) return old;
        const nextMessages = patchMessagesUnreadSummary(old.data.messages, {
          contactId: detail.contactId,
          all: detail.all,
        });
        const nextPayload = {
          ...old,
          data: { ...old.data, messages: nextMessages },
        };
        writeDashboardBatchSummaryCache(restaurantId, widgets, nextPayload);
        return nextPayload;
      });
      return true;
    };

    const onMessagesRefresh = (event: Event) => {
      const detail = (event as CustomEvent<DashboardMessagesRefreshDetail | undefined>)
        .detail;
      if (detail && patchMessagesFromReadDetail(detail)) {
        return;
      }

      const conversations = peekUnifiedInboxCache(restaurantId);
      if (conversations) {
        patchMessagesFromInboxCache();
        return;
      }
      invalidateBatch();
    };

    const patchMessagesFromInboxCache = () => {
      const conversations = peekUnifiedInboxCache(restaurantId);
      if (!conversations) return;
      const nextMessages = deriveMessagesUnreadSummaryFromConversations(conversations);
      queryClient.setQueryData<DashboardBatchQueryData>(summaryKey, (old) => {
        if (!old) return old;
        const nextPayload = {
          ...old,
          data: { ...old.data, messages: nextMessages },
        };
        writeDashboardBatchSummaryCache(restaurantId, widgets, nextPayload);
        return nextPayload;
      });
    };

    const onInboxCache = (event: Event) => {
      const detail = (event as CustomEvent<{ restaurantId?: string }>).detail;
      if (detail?.restaurantId !== restaurantId) return;
      patchMessagesFromInboxCache();
    };

    const onWorkspaceChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ restaurantId?: string }>).detail;
      if (detail?.restaurantId) {
        clearDashboardBatchSummaryCache(detail.restaurantId);
      }
      invalidateBatch();
    };

    window.addEventListener(
      GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT,
      onWorkspaceChanged,
    );
    window.addEventListener(
      GWADA_DASHBOARD_RESERVATIONS_REFRESH_EVENT,
      invalidateBatch,
    );
    window.addEventListener(GWADA_STAFF_DATA_REFRESH_EVENT, invalidateBatch);
    window.addEventListener(GWADA_DASHBOARD_MESSAGES_REFRESH_EVENT, onMessagesRefresh);
    window.addEventListener(
      GWADA_UNIFIED_INBOX_CACHE_UPDATED_EVENT,
      onInboxCache,
    );

    return () => {
      window.removeEventListener(
        GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT,
        onWorkspaceChanged,
      );
      window.removeEventListener(
        GWADA_DASHBOARD_RESERVATIONS_REFRESH_EVENT,
        invalidateBatch,
      );
      window.removeEventListener(GWADA_STAFF_DATA_REFRESH_EVENT, invalidateBatch);
      window.removeEventListener(
        GWADA_DASHBOARD_MESSAGES_REFRESH_EVENT,
        onMessagesRefresh,
      );
      window.removeEventListener(
        GWADA_UNIFIED_INBOX_CACHE_UPDATED_EVENT,
        onInboxCache,
      );
    };
  }, [enabled, queryClient, restaurantId, widgets]);

  return null;
}

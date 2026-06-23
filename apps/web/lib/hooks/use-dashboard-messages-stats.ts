"use client";

import { useEffect, useRef, useState } from "react";
import { fetchMessagesUnreadSummaryClient } from "@/lib/contact-messages/fetch-inbox-client";
import {
  deriveMessagesUnreadSummaryFromConversations,
  type MessagesUnreadSummary,
} from "@/lib/contact-messages/messages-unread-summary";
import {
  GWADA_UNIFIED_INBOX_CACHE_UPDATED_EVENT,
  clearUnifiedInboxCache,
  peekUnifiedInboxCache,
} from "@/lib/contact-messages/unified-inbox-cache";
import { GWADA_DASHBOARD_MESSAGES_REFRESH_EVENT, type DashboardMessagesRefreshDetail } from "@/lib/dashboard/dashboard-live-events";
import { patchMessagesUnreadSummary } from "@/lib/dashboard/patch-dashboard-messages-read-client";
import { GWADA_DASHBOARD_WIDGETS_REFRESH_EVENT } from "@/lib/dashboard/dashboard-widget-refresh";
import { useDashboardBatchQueryEnabled } from "@/lib/hooks/use-dashboard-batch-query-enabled";
import { useDashboardBatchSlice } from "@/lib/hooks/use-dashboard-batch-slice";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT } from "@/lib/supabase/workspace-persistence";

const EMPTY_SUMMARY: MessagesUnreadSummary = {
  total_unread: 0,
  unread: [],
  inboxConversations: [],
};

function summaryFromCache(
  restaurantId: string,
): MessagesUnreadSummary | null {
  const conversations = peekUnifiedInboxCache(restaurantId);
  if (!conversations) return null;
  return deriveMessagesUnreadSummaryFromConversations(conversations);
}

export function useDashboardMessagesStats() {
  const batchEnabled = useDashboardBatchQueryEnabled();
  const batchSlice = useDashboardBatchSlice("messages");
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const hasDataRef = useRef(false);
  const [summary, setSummary] = useState<MessagesUnreadSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const ready =
    workspaceReady &&
    Boolean(restaurantId && isUuidRestaurantId(restaurantId));

  useEffect(() => {
    if (batchEnabled) return;

    if (!restaurantId || !isUuidRestaurantId(restaurantId)) {
      hasDataRef.current = false;
      setSummary(null);
      setError(null);
      setIsLoading(true);
      return;
    }

    let cancel = false;

    const applyCache = (): boolean => {
      const next = summaryFromCache(restaurantId);
      if (!next) return false;
      setSummary(next);
      hasDataRef.current = true;
      setError(null);
      setIsLoading(false);
      return true;
    };

    const hadCache = applyCache();
    if (!hadCache) {
      setSummary(null);
      setError(null);
      setIsLoading(true);
      hasDataRef.current = false;
    }

    const refreshSummary = async (opts?: { silent?: boolean }) => {
      if (cancel) return;

      if (!opts?.silent && !hasDataRef.current) {
        setIsLoading(true);
      }

      const { data, error: err } = await fetchMessagesUnreadSummaryClient(
        restaurantId,
        { scope: "dashboard" },
      );

      if (cancel) return;

      if (err) {
        if (!hasDataRef.current) {
          setSummary(null);
          setError(err);
          setIsLoading(false);
        }
        return;
      }

      setSummary(data ?? EMPTY_SUMMARY);
      hasDataRef.current = true;
      setError(null);
      setIsLoading(false);
    };

    void refreshSummary({ silent: hadCache });

    const onCacheUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ restaurantId?: string }>).detail;
      if (detail?.restaurantId !== restaurantId) return;
      applyCache();
    };

    const onPoll = (event: Event) => {
      const detail = (event as CustomEvent<DashboardMessagesRefreshDetail | undefined>)
        .detail;
      if (
        detail?.restaurantId === restaurantId &&
        (detail.all || detail.contactId)
      ) {
        setSummary((prev) => {
          if (!prev) return prev;
          return patchMessagesUnreadSummary(prev, {
            contactId: detail.contactId,
            all: detail.all,
          });
        });
        hasDataRef.current = true;
        setError(null);
        setIsLoading(false);
        return;
      }
      void refreshSummary({ silent: true });
    };
    const onRestaurantChange = () => {
      clearUnifiedInboxCache(restaurantId);
      hasDataRef.current = false;
      setSummary(null);
      setError(null);
      setIsLoading(true);
      void refreshSummary();
    };

    window.addEventListener(
      GWADA_UNIFIED_INBOX_CACHE_UPDATED_EVENT,
      onCacheUpdated,
    );
    window.addEventListener(GWADA_DASHBOARD_WIDGETS_REFRESH_EVENT, onPoll);
    window.addEventListener(
      GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT,
      onRestaurantChange,
    );
    window.addEventListener(GWADA_DASHBOARD_MESSAGES_REFRESH_EVENT, onPoll);

    return () => {
      cancel = true;
      window.removeEventListener(
        GWADA_UNIFIED_INBOX_CACHE_UPDATED_EVENT,
        onCacheUpdated,
      );
      window.removeEventListener(GWADA_DASHBOARD_WIDGETS_REFRESH_EVENT, onPoll);
      window.removeEventListener(
        GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT,
        onRestaurantChange,
      );
      window.removeEventListener(GWADA_DASHBOARD_MESSAGES_REFRESH_EVENT, onPoll);
    };
  }, [batchEnabled, restaurantId]);

  if (batchEnabled) {
    return {
      summary: batchSlice.summary,
      error: batchSlice.error,
      ready: batchSlice.ready,
      loading: batchSlice.loading,
    };
  }

  return {
    summary,
    error,
    ready,
    loading: error == null && (isLoading || summary === null),
  };
}

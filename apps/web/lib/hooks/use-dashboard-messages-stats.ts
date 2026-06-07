"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchMessagesUnreadSummaryClient } from "@/lib/contact-messages/fetch-inbox-client";
import type { MessagesUnreadSummary } from "@/lib/contact-messages/messages-unread-summary";
import { setUnifiedInboxCache } from "@/lib/contact-messages/unified-inbox-cache";
import { GWADA_DASHBOARD_MESSAGES_REFRESH_EVENT } from "@/lib/dashboard/dashboard-live-events";
import {
  GWADA_DASHBOARD_WIDGETS_REFRESH_EVENT,
  useDashboardHasDataRef,
} from "@/lib/dashboard/dashboard-widget-refresh";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT } from "@/lib/supabase/workspace-persistence";

export function useDashboardMessagesStats() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const hasDataRef = useDashboardHasDataRef();
  const [summary, setSummary] = useState<MessagesUnreadSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId || !isUuidRestaurantId(restaurantId)) {
      hasDataRef.current = false;
      setSummary(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancel = false;
    hasDataRef.current = false;

    const run = async (silent: boolean) => {
      if (cancel) return;
      const initial = !hasDataRef.current;
      if (!silent && initial) setLoading(true);
      if (!silent) setError(null);

      const { data, error: err } = await fetchMessagesUnreadSummaryClient(
        restaurantId,
        { scope: "dashboard" },
      );

      if (cancel) return;

      if (err) {
        if (!hasDataRef.current) {
          setSummary(null);
          setError(err);
        }
        if (!silent && initial) setLoading(false);
        return;
      }

      const next = data ?? {
        total_unread: 0,
        unread: [],
        inboxConversations: [],
      };
      setSummary(next);
      hasDataRef.current = true;
      if (!silent && initial) setLoading(false);
      if (next.inboxConversations.length > 0) {
        setUnifiedInboxCache(restaurantId, next.inboxConversations);
      }
    };

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
    window.addEventListener(GWADA_DASHBOARD_MESSAGES_REFRESH_EVENT, onPoll);

    return () => {
      cancel = true;
      window.removeEventListener(GWADA_DASHBOARD_WIDGETS_REFRESH_EVENT, onPoll);
      window.removeEventListener(
        GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT,
        onRestaurantChange,
      );
      window.removeEventListener(GWADA_DASHBOARD_MESSAGES_REFRESH_EVENT, onPoll);
    };
  }, [restaurantId, hasDataRef]);

  return {
    summary,
    loading,
    error,
    ready: workspaceReady && Boolean(restaurantId && isUuidRestaurantId(restaurantId)),
  };
}

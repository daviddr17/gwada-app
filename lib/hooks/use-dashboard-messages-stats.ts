"use client";

import { useEffect, useState } from "react";
import { fetchMessagesUnreadSummaryClient } from "@/lib/contact-messages/fetch-inbox-client";
import type { MessagesUnreadSummary } from "@/lib/contact-messages/messages-unread-summary";
import { setUnifiedInboxCache } from "@/lib/contact-messages/unified-inbox-cache";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { GWADA_DASHBOARD_MESSAGES_REFRESH_EVENT } from "@/lib/dashboard/dashboard-live-events";
import { GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT } from "@/lib/supabase/workspace-persistence";

export function useDashboardMessagesStats() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const [summary, setSummary] = useState<MessagesUnreadSummary | null>(null);
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
      const { data, error: err } = await fetchMessagesUnreadSummaryClient(
        restaurantId,
        { scope: "dashboard" },
      );
      if (cancel) return;
      setLoading(false);
      if (err) {
        setSummary(null);
        setError(err);
        return;
      }
      const next = data ?? { total_unread: 0, unread: [], inboxConversations: [] };
      setSummary(next);
      if (restaurantId && next.inboxConversations.length > 0) {
        setUnifiedInboxCache(restaurantId, next.inboxConversations);
      }
    };

    void run();

    const onChange = () => void run();
    window.addEventListener(GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT, onChange);
    window.addEventListener(GWADA_DASHBOARD_MESSAGES_REFRESH_EVENT, onChange);
    return () => {
      cancel = true;
      window.removeEventListener(GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT, onChange);
      window.removeEventListener(GWADA_DASHBOARD_MESSAGES_REFRESH_EVENT, onChange);
    };
  }, [restaurantId]);

  return {
    summary,
    loading,
    error,
    ready: workspaceReady && Boolean(restaurantId && isUuidRestaurantId(restaurantId)),
  };
}

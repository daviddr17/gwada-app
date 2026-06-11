"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GWADA_DASHBOARD_MESSAGES_REFRESH_EVENT } from "@/lib/dashboard/dashboard-live-events";
import { GWADA_DASHBOARD_WIDGETS_REFRESH_EVENT } from "@/lib/dashboard/dashboard-widget-refresh";
import { fetchNotificationSummaryClient } from "@/lib/notifications/fetch-notifications-client";
import {
  GWADA_NOTIFICATIONS_REFRESH_EVENT,
  dispatchNotificationsRefresh,
} from "@/lib/notifications/notification-events";
import type { NotificationModuleId } from "@/lib/notifications/notification-modules";
import { NOTIFICATION_BELL_POLL_MS } from "@/lib/notifications/notification-preferences";
import type { NotificationSummary } from "@/lib/notifications/notification-types";
import { markNotificationReadClient } from "@/lib/notifications/fetch-notifications-client";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT } from "@/lib/supabase/workspace-persistence";

export function useNotificationSummary() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const hasDataRef = useRef(false);
  const [summary, setSummary] = useState<NotificationSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const ready =
    workspaceReady &&
    Boolean(restaurantId && isUuidRestaurantId(restaurantId));

  const refresh = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!restaurantId || !isUuidRestaurantId(restaurantId)) return;

      if (!opts?.silent && !hasDataRef.current) {
        setIsLoading(true);
      }

      const { data, error: fetchError } =
        await fetchNotificationSummaryClient(restaurantId);

      if (!data && fetchError) {
        setError(fetchError);
        if (!hasDataRef.current) {
          setSummary(null);
        }
        setIsLoading(false);
        return;
      }

      if (data) {
        setSummary(data);
        hasDataRef.current = true;
        setError(null);
      }
      setIsLoading(false);
    },
    [restaurantId],
  );

  useEffect(() => {
    if (!ready || !restaurantId) {
      hasDataRef.current = false;
      setSummary(null);
      setError(null);
      setIsLoading(true);
      return;
    }

    let cancel = false;

    const run = async (opts?: { silent?: boolean }) => {
      if (cancel) return;
      await refresh(opts);
    };

    void run();

    const onRefresh = () => {
      void run({ silent: true });
    };

    window.addEventListener(GWADA_NOTIFICATIONS_REFRESH_EVENT, onRefresh);
    window.addEventListener(GWADA_DASHBOARD_MESSAGES_REFRESH_EVENT, onRefresh);
    window.addEventListener(GWADA_DASHBOARD_WIDGETS_REFRESH_EVENT, onRefresh);
    window.addEventListener(GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT, onRefresh);

    const interval = window.setInterval(
      () => void run({ silent: true }),
      NOTIFICATION_BELL_POLL_MS,
    );

    return () => {
      cancel = true;
      window.clearInterval(interval);
      window.removeEventListener(GWADA_NOTIFICATIONS_REFRESH_EVENT, onRefresh);
      window.removeEventListener(
        GWADA_DASHBOARD_MESSAGES_REFRESH_EVENT,
        onRefresh,
      );
      window.removeEventListener(
        GWADA_DASHBOARD_WIDGETS_REFRESH_EVENT,
        onRefresh,
      );
      window.removeEventListener(
        GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT,
        onRefresh,
      );
    };
  }, [ready, restaurantId, refresh]);

  const markRead = useCallback(
    async (params: {
      module: NotificationModuleId;
      itemId: string;
      meta?: Record<string, string>;
    }) => {
      if (!restaurantId) return { ok: false as const, error: "no_restaurant" };

      setSummary((prev) => {
        if (!prev) return prev;
        const modules = prev.modules
          .map((mod) => {
            if (mod.id !== params.module) return mod;
            const items = mod.items.filter((i) => i.id !== params.itemId);
            const removed = mod.items.length - items.length;
            return {
              ...mod,
              items,
              count: Math.max(0, mod.count - removed),
            };
          })
          .filter((mod) => mod.count > 0);
        const totalCount = modules.reduce((sum, m) => sum + m.count, 0);
        return { ...prev, modules, totalCount };
      });

      const result = await markNotificationReadClient({
        restaurantId,
        module: params.module,
        itemId: params.itemId,
        meta: params.meta,
      });

      if (!result.ok) {
        void refresh({ silent: true });
      } else {
        dispatchNotificationsRefresh();
      }

      return result;
    },
    [restaurantId, refresh],
  );

  return {
    summary,
    totalCount: summary?.totalCount ?? 0,
    error,
    isLoading: !ready || isLoading,
    ready,
    refresh,
    markRead,
  };
}

"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { GWADA_DASHBOARD_MESSAGES_REFRESH_EVENT } from "@/lib/dashboard/dashboard-live-events";
import {
  fetchNotificationSummaryClient,
  markNotificationReadClient,
} from "@/lib/notifications/fetch-notifications-client";
import {
  GWADA_NOTIFICATIONS_REFRESH_EVENT,
} from "@/lib/notifications/notification-events";
import type { NotificationModuleId } from "@/lib/notifications/notification-modules";
import type { NotificationSummary } from "@/lib/notifications/notification-types";
import {
  NOTIFICATION_SUMMARY_GC_MS,
  NOTIFICATION_SUMMARY_REFETCH_MS,
  NOTIFICATION_SUMMARY_STALE_MS,
} from "@/lib/query/dashboard-query-policy";
import { queryKeys } from "@/lib/query/query-keys";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT } from "@/lib/supabase/workspace-persistence";

const MESSAGES_REFRESH_DEBOUNCE_MS = 3_000;

export function useNotificationSummary() {
  const queryClient = useQueryClient();
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const messagesDebounceRef = useRef<number | null>(null);

  const ready =
    workspaceReady &&
    Boolean(restaurantId && isUuidRestaurantId(restaurantId));

  const query = useQuery({
    queryKey: queryKeys.notifications.summary(restaurantId ?? ""),
    queryFn: async (): Promise<NotificationSummary> => {
      const { data, error } = await fetchNotificationSummaryClient(
        restaurantId!,
      );
      if (!data) throw new Error(error ?? "notification_summary_failed");
      return data;
    },
    enabled: ready,
    staleTime: NOTIFICATION_SUMMARY_STALE_MS,
    gcTime: NOTIFICATION_SUMMARY_GC_MS,
    refetchInterval: () =>
      typeof document !== "undefined" &&
      document.visibilityState === "visible"
        ? NOTIFICATION_SUMMARY_REFETCH_MS
        : false,
    refetchIntervalInBackground: false,
    placeholderData: (previous) => previous,
  });

  const refresh = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!restaurantId || !isUuidRestaurantId(restaurantId)) return;
      if (opts?.silent) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.notifications.summaryRoot(restaurantId),
          refetchType: "active",
        });
        return;
      }
      await query.refetch();
    },
    [query, queryClient, restaurantId],
  );

  useEffect(() => {
    if (!ready || !restaurantId) return;

    const invalidate = () => {
      void queryClient.refetchQueries({
        queryKey: queryKeys.notifications.summaryRoot(restaurantId),
        type: "active",
      });
    };

    const onMessagesRefresh = () => {
      if (messagesDebounceRef.current) {
        window.clearTimeout(messagesDebounceRef.current);
      }
      messagesDebounceRef.current = window.setTimeout(() => {
        messagesDebounceRef.current = null;
        invalidate();
      }, MESSAGES_REFRESH_DEBOUNCE_MS);
    };

    window.addEventListener(GWADA_NOTIFICATIONS_REFRESH_EVENT, invalidate);
    window.addEventListener(
      GWADA_DASHBOARD_MESSAGES_REFRESH_EVENT,
      onMessagesRefresh,
    );
    window.addEventListener(GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT, invalidate);

    return () => {
      if (messagesDebounceRef.current) {
        window.clearTimeout(messagesDebounceRef.current);
      }
      window.removeEventListener(GWADA_NOTIFICATIONS_REFRESH_EVENT, invalidate);
      window.removeEventListener(
        GWADA_DASHBOARD_MESSAGES_REFRESH_EVENT,
        onMessagesRefresh,
      );
      window.removeEventListener(
        GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT,
        invalidate,
      );
    };
  }, [queryClient, ready, restaurantId]);

  const markRead = useCallback(
    async (params: {
      module: NotificationModuleId;
      itemId: string;
      meta?: Record<string, string>;
    }) => {
      if (!restaurantId) return { ok: false as const, error: "no_restaurant" };

      const summaryKey = queryKeys.notifications.summary(restaurantId);
      queryClient.setQueryData<NotificationSummary>(summaryKey, (prev) => {
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
      }

      return result;
    },
    [queryClient, restaurantId, refresh],
  );

  const markModuleRead = useCallback(
    async (params: { module: NotificationModuleId }) => {
      if (!restaurantId) return { ok: false as const, error: "no_restaurant" };

      const summaryKey = queryKeys.notifications.summary(restaurantId);
      queryClient.setQueryData<NotificationSummary>(summaryKey, (prev) => {
        if (!prev) return prev;
        const modules = prev.modules.filter((mod) => mod.id !== params.module);
        const totalCount = modules.reduce((sum, m) => sum + m.count, 0);
        return { ...prev, modules, totalCount };
      });

      const result = await markNotificationReadClient(
        {
          restaurantId,
          module: params.module,
          itemId: null,
        },
        { notify: false },
      );

      if (!result.ok) {
        void refresh({ silent: true });
        return { ok: false as const, error: "mark_module_read_failed" };
      }

      return { ok: true as const, error: null };
    },
    [queryClient, restaurantId, refresh],
  );

  return {
    summary: query.data ?? null,
    totalCount: query.data?.totalCount ?? 0,
    error: query.error ? String(query.error) : null,
    isLoading: !ready || query.isLoading,
    ready,
    refresh,
    markRead,
    markModuleRead,
  };
}

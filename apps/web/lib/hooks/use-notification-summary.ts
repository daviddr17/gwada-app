"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { invalidateMessagesInboxAfterMarkRead } from "@/lib/contact-messages/invalidate-messages-inbox-cache-client";
import {
  GWADA_UNIFIED_INBOX_CACHE_UPDATED_EVENT,
  peekUnifiedInboxCache,
} from "@/lib/contact-messages/unified-inbox-cache";
import { GWADA_DASHBOARD_MESSAGES_REFRESH_EVENT } from "@/lib/dashboard/dashboard-live-events";
import {
  fetchNotificationSummaryClient,
  markNotificationReadClient,
} from "@/lib/notifications/fetch-notifications-client";
import { notificationSummaryWithMessagesFromConversations } from "@/lib/notifications/patch-notification-messages-from-inbox-cache";
import {
  GWADA_NOTIFICATIONS_MESSAGE_LIVE_EVENT,
  GWADA_NOTIFICATIONS_REFRESH_EVENT,
  dispatchNotificationsRefresh,
} from "@/lib/notifications/notification-events";
import type { NotificationModuleId } from "@/lib/notifications/notification-modules";
import type { NotificationSummary } from "@/lib/notifications/notification-types";
import { patchNotificationSummaryFromNotificationPayload } from "@/lib/contact-messages/patch-inbox-from-message-row";
import {
  NOTIFICATION_SUMMARY_GC_MS,
  NOTIFICATION_SUMMARY_REFETCH_MS,
  NOTIFICATION_SUMMARY_STALE_MS,
} from "@/lib/query/dashboard-query-policy";
import { isNotificationBellRealtimeActive } from "@/lib/hooks/use-notification-bell-realtime";
import { queryKeys } from "@/lib/query/query-keys";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT } from "@/lib/supabase/workspace-persistence";

const MESSAGES_REFRESH_DEBOUNCE_MS = 15_000;
const NOTIFICATIONS_FULL_REFRESH_DEBOUNCE_MS = 2_000;

export function useNotificationSummary() {
  const queryClient = useQueryClient();
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const messagesDebounceRef = useRef<number | null>(null);
  const fullRefreshDebounceRef = useRef<number | null>(null);
  const livePatchAtRef = useRef(0);

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
      const conversations = peekUnifiedInboxCache(restaurantId!);
      if (!conversations) return data;
      return notificationSummaryWithMessagesFromConversations(
        data,
        conversations,
      );
    },
    enabled: ready,
    staleTime: NOTIFICATION_SUMMARY_STALE_MS,
    gcTime: NOTIFICATION_SUMMARY_GC_MS,
    refetchInterval: () =>
      typeof document !== "undefined" &&
      document.visibilityState === "visible" &&
      !isNotificationBellRealtimeActive()
        ? NOTIFICATION_SUMMARY_REFETCH_MS
        : false,
    refetchIntervalInBackground: false,
    placeholderData: (previous, previousQuery) => {
      const prevRestaurantId = previousQuery?.queryKey[2];
      if (
        typeof prevRestaurantId === "string" &&
        prevRestaurantId !== restaurantId
      ) {
        return undefined;
      }
      return previous;
    },
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
      if (fullRefreshDebounceRef.current) {
        window.clearTimeout(fullRefreshDebounceRef.current);
      }
      fullRefreshDebounceRef.current = window.setTimeout(() => {
        fullRefreshDebounceRef.current = null;
        if (Date.now() - livePatchAtRef.current < 5_000) return;
        void queryClient.refetchQueries({
          queryKey: queryKeys.notifications.summaryRoot(restaurantId),
          type: "active",
        });
      }, NOTIFICATIONS_FULL_REFRESH_DEBOUNCE_MS);
    };

    const patchMessagesFromInboxCache = () => {
      const conversations = peekUnifiedInboxCache(restaurantId);
      if (!conversations) return;
      livePatchAtRef.current = Date.now();
      const summaryKey = queryKeys.notifications.summary(restaurantId);
      queryClient.setQueryData<NotificationSummary>(summaryKey, (prev) => {
        if (!prev) return prev;
        return notificationSummaryWithMessagesFromConversations(
          prev,
          conversations,
        );
      });
    };

    /** Fallback wenn Inbox-Mount inaktiv (andere Route): Payload von notification_events. */
    const onMessageLive = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          restaurantId?: string;
          notificationPayload?: Record<string, unknown>;
        }>
      ).detail;
      if (detail?.restaurantId !== restaurantId || !detail.notificationPayload) {
        return;
      }
      if (Date.now() - livePatchAtRef.current < 3_000) return;

      livePatchAtRef.current = Date.now();
      const summaryKey = queryKeys.notifications.summary(restaurantId);
      queryClient.setQueryData<NotificationSummary>(summaryKey, (prev) => {
        if (!prev) {
          void queryClient.prefetchQuery({ queryKey: summaryKey });
          return prev;
        }
        return patchNotificationSummaryFromNotificationPayload(
          prev,
          detail.notificationPayload!,
        );
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

    const onInboxCacheUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ restaurantId?: string }>).detail;
      if (detail?.restaurantId !== restaurantId) return;
      patchMessagesFromInboxCache();
    };

    window.addEventListener(GWADA_NOTIFICATIONS_REFRESH_EVENT, invalidate);
    window.addEventListener(
      GWADA_NOTIFICATIONS_MESSAGE_LIVE_EVENT,
      onMessageLive,
    );
    window.addEventListener(
      GWADA_DASHBOARD_MESSAGES_REFRESH_EVENT,
      onMessagesRefresh,
    );
    window.addEventListener(
      GWADA_UNIFIED_INBOX_CACHE_UPDATED_EVENT,
      onInboxCacheUpdated,
    );
    window.addEventListener(GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT, invalidate);

    return () => {
      if (messagesDebounceRef.current) {
        window.clearTimeout(messagesDebounceRef.current);
      }
      if (fullRefreshDebounceRef.current) {
        window.clearTimeout(fullRefreshDebounceRef.current);
      }
      window.removeEventListener(GWADA_NOTIFICATIONS_REFRESH_EVENT, invalidate);
      window.removeEventListener(
        GWADA_NOTIFICATIONS_MESSAGE_LIVE_EVENT,
        onMessageLive,
      );
      window.removeEventListener(
        GWADA_DASHBOARD_MESSAGES_REFRESH_EVENT,
        onMessagesRefresh,
      );
      window.removeEventListener(
        GWADA_UNIFIED_INBOX_CACHE_UPDATED_EVENT,
        onInboxCacheUpdated,
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

      const isMessages = params.module === "messages";
      const summaryKey = queryKeys.notifications.summary(restaurantId);

      /** Nachrichten: WAHA/IMAP erst serverseitig — kein optimistisches Badge-0. */
      if (!isMessages) {
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
      }

      const result = await markNotificationReadClient(
        {
          restaurantId,
          module: params.module,
          itemId: params.itemId,
          meta: params.meta,
        },
        { notify: false },
      );

      if (result.ok && isMessages) {
        invalidateMessagesInboxAfterMarkRead({
          restaurantId,
          contactId: params.itemId ?? params.meta?.contactId,
        });
        dispatchNotificationsRefresh();
        await refresh({ silent: true });
      } else if (!result.ok && !isMessages) {
        void refresh({ silent: true });
      } else if (result.ok && !isMessages) {
        dispatchNotificationsRefresh();
      }

      return result;
    },
    [queryClient, restaurantId, refresh],
  );

  const markModuleRead = useCallback(
    async (params: { module: NotificationModuleId }) => {
      if (!restaurantId) return { ok: false as const, error: "no_restaurant" };

      const isMessages = params.module === "messages";
      const summaryKey = queryKeys.notifications.summary(restaurantId);

      if (!isMessages) {
        queryClient.setQueryData<NotificationSummary>(summaryKey, (prev) => {
          if (!prev) return prev;
          const modules = prev.modules.filter((mod) => mod.id !== params.module);
          const totalCount = modules.reduce((sum, m) => sum + m.count, 0);
          return { ...prev, modules, totalCount };
        });
      }

      const result = await markNotificationReadClient(
        {
          restaurantId,
          module: params.module,
          itemId: null,
        },
        { notify: false },
      );

      if (!result.ok) {
        if (!isMessages) void refresh({ silent: true });
        return { ok: false as const, error: "mark_module_read_failed" };
      }

      if (isMessages) {
        invalidateMessagesInboxAfterMarkRead({ restaurantId, all: true });
        dispatchNotificationsRefresh();
        await refresh({ silent: true });
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
    isFetching: query.isFetching,
    ready,
    refresh,
    markRead,
    markModuleRead,
  };
}

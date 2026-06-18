"use client";

import { useEffect, useRef } from "react";
import {
  GWADA_NOTIFICATIONS_MESSAGE_LIVE_EVENT,
  dispatchNotificationsRefresh,
} from "@/lib/notifications/notification-events";
import { useVisibleIntervalPolling } from "@/lib/hooks/use-visible-interval-polling";
import { isPublicSupabaseProxyEnabled } from "@/lib/public-env";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { subscribeRestaurantTableInserts } from "@/lib/supabase/restaurant-table-realtime";
import { NOTIFICATION_SUMMARY_REFETCH_MS } from "@/lib/query/dashboard-query-policy";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";

const REALTIME_READY_TIMEOUT_MS = 12_000;
const BELL_FULL_REFRESH_DEBOUNCE_MS = 2_000;

let bellRealtimeActive = false;

/** Glocke: kein 60s-Poll, solange Realtime verbunden ist. */
export function isNotificationBellRealtimeActive(): boolean {
  return bellRealtimeActive;
}

/**
 * Glocke: INSERT auf `notification_events`.
 * Nachrichten: Badge über Inbox-Cache (contact_messages Realtime) — kein doppelter Refetch.
 */
export function useNotificationBellRealtime() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const sbRef = useRef(createSupabaseBrowserClient());
  const polling = useVisibleIntervalPolling(NOTIFICATION_SUMMARY_REFETCH_MS);
  const fullRefreshDebounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!ready || !restaurantId || !isUuidRestaurantId(restaurantId)) {
      bellRealtimeActive = false;
      return;
    }

    bellRealtimeActive = false;

    const refreshBell = () => {
      if (fullRefreshDebounceRef.current) {
        window.clearTimeout(fullRefreshDebounceRef.current);
      }
      fullRefreshDebounceRef.current = window.setTimeout(() => {
        fullRefreshDebounceRef.current = null;
        dispatchNotificationsRefresh();
      }, BELL_FULL_REFRESH_DEBOUNCE_MS);
    };

    const enablePolling = () => {
      bellRealtimeActive = false;
      polling.start(() => {
        if (document.visibilityState !== "visible") return;
        refreshBell();
      });
    };

    const disablePolling = () => {
      bellRealtimeActive = true;
      polling.stop();
    };

    if (isPublicSupabaseProxyEnabled()) {
      enablePolling();
      return () => {
        bellRealtimeActive = false;
        polling.stop();
      };
    }

    const readyTimeout = window.setTimeout(() => {
      if (!bellRealtimeActive) enablePolling();
    }, REALTIME_READY_TIMEOUT_MS);

    const teardown = subscribeRestaurantTableInserts(sbRef.current, {
      channelName: `notification-bell-live:${restaurantId}`,
      table: "notification_events",
      restaurantId,
      onStatus: (status) => {
        if (status === "SUBSCRIBED") {
          disablePolling();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          enablePolling();
        } else if (status === "CLOSED") {
          enablePolling();
        }
      },
      onInsert: (payload) => {
        const row = payload.new as {
          module?: string;
          payload?: Record<string, unknown>;
        };
        if (row.module === "messages" && row.payload) {
          window.dispatchEvent(
            new CustomEvent(GWADA_NOTIFICATIONS_MESSAGE_LIVE_EVENT, {
              detail: {
                restaurantId,
                notificationPayload: row.payload,
              },
            }),
          );
          return;
        }
        refreshBell();
      },
    });

    return () => {
      window.clearTimeout(readyTimeout);
      if (fullRefreshDebounceRef.current) {
        window.clearTimeout(fullRefreshDebounceRef.current);
        fullRefreshDebounceRef.current = null;
      }
      bellRealtimeActive = false;
      polling.stop();
      teardown();
    };
  }, [ready, restaurantId, polling.start, polling.stop]);
}

"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { dispatchDashboardMessagesRefresh } from "@/lib/dashboard/dashboard-live-events";
import { useVisibleIntervalPolling } from "@/lib/hooks/use-visible-interval-polling";
import { isPublicSupabaseProxyEnabled } from "@/lib/public-env";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { subscribeRestaurantTableInserts } from "@/lib/supabase/restaurant-table-realtime";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";

const MESSAGES_DEBOUNCE_MS = 4_000;
const MESSAGES_POLL_MS = 60_000;
const REALTIME_READY_TIMEOUT_MS = 12_000;

/**
 * Nachrichten-Realtime im Dashboard-Layout; bei Ausfall Polling (60 s).
 */
export function useDashboardLiveNotifications() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const messagesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesToastRef = useRef(false);
  const realtimeSubscribedRef = useRef(false);
  const sbRef = useRef(createSupabaseBrowserClient());
  const polling = useVisibleIntervalPolling(MESSAGES_POLL_MS);

  useEffect(() => {
    if (!ready || !restaurantId || !isUuidRestaurantId(restaurantId)) return;

    realtimeSubscribedRef.current = false;

    const scheduleMessagesRefresh = () => {
      if (messagesDebounceRef.current) {
        clearTimeout(messagesDebounceRef.current);
      }
      messagesDebounceRef.current = setTimeout(() => {
        messagesDebounceRef.current = null;
        dispatchDashboardMessagesRefresh();
      }, MESSAGES_DEBOUNCE_MS);
    };

    const enablePolling = () => {
      polling.start(() => {
        if (document.visibilityState !== "visible") return;
        dispatchDashboardMessagesRefresh();
      });
    };

    const disablePolling = () => {
      polling.stop();
    };

    if (isPublicSupabaseProxyEnabled()) {
      enablePolling();
    }

    const readyTimeout = window.setTimeout(() => {
      if (!realtimeSubscribedRef.current) enablePolling();
    }, REALTIME_READY_TIMEOUT_MS);

    const teardown = subscribeRestaurantTableInserts(sbRef.current, {
      channelName: `dashboard-messages-live:${restaurantId}`,
      table: "contact_messages",
      restaurantId,
      onStatus: (status) => {
        if (status === "SUBSCRIBED") {
          realtimeSubscribedRef.current = true;
          disablePolling();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          enablePolling();
        }
      },
      onInsert: (payload) => {
        if (payload.new.direction !== "inbound") return;
        if (!messagesToastRef.current) {
          messagesToastRef.current = true;
          toast.info("Neue Nachricht", {
            description: "Nachrichten-Widget wird aktualisiert.",
            duration: 4_000,
          });
          setTimeout(() => {
            messagesToastRef.current = false;
          }, MESSAGES_DEBOUNCE_MS);
        }
        scheduleMessagesRefresh();
      },
    });

    return () => {
      window.clearTimeout(readyTimeout);
      if (messagesDebounceRef.current) {
        clearTimeout(messagesDebounceRef.current);
        messagesDebounceRef.current = null;
      }
      disablePolling();
      teardown();
    };
  }, [ready, restaurantId, polling.start, polling.stop]);
}

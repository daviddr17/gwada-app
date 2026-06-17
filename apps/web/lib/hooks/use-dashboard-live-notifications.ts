"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { dispatchDashboardMessagesRefresh } from "@/lib/dashboard/dashboard-live-events";
import { useVisibleIntervalPolling } from "@/lib/hooks/use-visible-interval-polling";
import { UNIFIED_INBOX_BACKGROUND_POLL_MS } from "@/lib/contact-messages/unified-inbox-background-sync";
import { isPublicSupabaseProxyEnabled } from "@/lib/public-env";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { subscribeRestaurantTableInserts } from "@/lib/supabase/restaurant-table-realtime";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";

const LIVE_REFRESH_DEBOUNCE_MS = 3_000;
const REALTIME_READY_TIMEOUT_MS = 12_000;

/**
 * Inbox-Live: Realtime auf `contact_messages` + WAHA-Signale; Fallback-Polling (5 min).
 * Läuft auf Dashboard (nur mit Nachrichten-Widget) und Kontakte — löst leisen Cache-Refresh aus.
 */
export function useInboxLiveNotifications(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastRef = useRef(false);
  const messagesLiveRef = useRef(false);
  const signalsLiveRef = useRef(false);
  const sbRef = useRef(createSupabaseBrowserClient());
  const polling = useVisibleIntervalPolling(UNIFIED_INBOX_BACKGROUND_POLL_MS);

  useEffect(() => {
    if (!enabled) return;
    if (!ready || !restaurantId || !isUuidRestaurantId(restaurantId)) return;

    messagesLiveRef.current = false;
    signalsLiveRef.current = false;

    const scheduleRefresh = (showToast: boolean) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        dispatchDashboardMessagesRefresh();
      }, LIVE_REFRESH_DEBOUNCE_MS);

      if (!showToast || toastRef.current) return;
      toastRef.current = true;
      toast.info("Neue Nachricht", {
        description: "Posteingang wird aktualisiert.",
        duration: 4_000,
      });
      setTimeout(() => {
        toastRef.current = false;
      }, LIVE_REFRESH_DEBOUNCE_MS);
    };

    const syncPolling = () => {
      if (messagesLiveRef.current && signalsLiveRef.current) {
        polling.stop();
      } else {
        polling.start(() => {
          if (document.visibilityState !== "visible") return;
          dispatchDashboardMessagesRefresh();
        });
      }
    };

    if (isPublicSupabaseProxyEnabled()) {
      polling.start(() => {
        if (document.visibilityState !== "visible") return;
        dispatchDashboardMessagesRefresh();
      });
    }

    const readyTimeout = window.setTimeout(() => {
      if (!messagesLiveRef.current || !signalsLiveRef.current) {
        polling.start(() => {
          if (document.visibilityState !== "visible") return;
          dispatchDashboardMessagesRefresh();
        });
      }
    }, REALTIME_READY_TIMEOUT_MS);

    const teardownMessages = subscribeRestaurantTableInserts(sbRef.current, {
      channelName: `inbox-live-messages:${restaurantId}`,
      table: "contact_messages",
      restaurantId,
      onStatus: (status) => {
        if (status === "SUBSCRIBED") {
          messagesLiveRef.current = true;
          syncPolling();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          messagesLiveRef.current = false;
          syncPolling();
        }
      },
      onInsert: (payload) => {
        if (payload.new.direction !== "inbound") return;
        scheduleRefresh(true);
      },
    });

    const teardownSignals = subscribeRestaurantTableInserts(sbRef.current, {
      channelName: `inbox-live-signals:${restaurantId}`,
      table: "restaurant_inbox_signals",
      restaurantId,
      onStatus: (status) => {
        if (status === "SUBSCRIBED") {
          signalsLiveRef.current = true;
          syncPolling();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          signalsLiveRef.current = false;
          syncPolling();
        }
      },
      onInsert: (payload) => {
        const source = payload.new.source;
        if (source === "waha") {
          scheduleRefresh(true);
        } else if (source === "waha_ack") {
          scheduleRefresh(false);
        }
      },
    });

    return () => {
      window.clearTimeout(readyTimeout);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      polling.stop();
      teardownMessages();
      teardownSignals();
    };
  }, [enabled, ready, restaurantId, polling.start, polling.stop]);
}

/** @deprecated Alias — nutze {@link useInboxLiveNotifications}. */
export const useDashboardLiveNotifications = useInboxLiveNotifications;

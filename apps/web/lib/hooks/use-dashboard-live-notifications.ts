"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { applyInboundMessageToInboxCache } from "@/lib/contact-messages/apply-inbound-to-inbox-cache";
import {
  dispatchDashboardMessagesRefresh,
  dispatchDashboardWahaMetadataRefresh,
} from "@/lib/dashboard/dashboard-live-events";
import { useVisibleIntervalPolling } from "@/lib/hooks/use-visible-interval-polling";
import { UNIFIED_INBOX_BACKGROUND_POLL_MS } from "@/lib/contact-messages/unified-inbox-background-sync";
import { isPublicSupabaseProxyEnabled } from "@/lib/public-env";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { mapContactMessageRowFromRecord } from "@/lib/supabase/contact-messages-db";
import { subscribeRestaurantTableInserts } from "@/lib/supabase/restaurant-table-realtime";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";

const RECONCILE_REFRESH_DEBOUNCE_MS = 15_000;
const WAHA_METADATA_REFRESH_DEBOUNCE_MS = 2_000;
const REALTIME_READY_TIMEOUT_MS = 12_000;
const INSERT_BURST_WINDOW_MS = 600;
/** Connect-Historie / Bulk-Import: kein Toast, ein Reconcile am Ende. */
const BULK_INSERT_THRESHOLD = 3;

/**
 * Inbox-Live: ein Realtime-Kanal auf `contact_messages` (Patch + optional Reconcile),
 * plus WAHA-Signale. Kein doppeltes Subscription neben inbox-list-live.
 */
export function useInboxLiveNotifications(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const reconcileRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wahaDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastRef = useRef(false);
  const messagesLiveRef = useRef(false);
  const signalsLiveRef = useRef(false);
  const burstCountRef = useRef(0);
  const burstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sbRef = useRef(createSupabaseBrowserClient());
  const polling = useVisibleIntervalPolling(UNIFIED_INBOX_BACKGROUND_POLL_MS);

  useEffect(() => {
    if (!enabled) return;
    if (!ready || !restaurantId || !isUuidRestaurantId(restaurantId)) return;

    messagesLiveRef.current = false;
    signalsLiveRef.current = false;

    const scheduleReconcile = () => {
      if (reconcileRef.current) clearTimeout(reconcileRef.current);
      reconcileRef.current = setTimeout(() => {
        reconcileRef.current = null;
        dispatchDashboardMessagesRefresh();
      }, RECONCILE_REFRESH_DEBOUNCE_MS);
    };

    const scheduleWahaMetadataRefresh = () => {
      if (wahaDebounceRef.current) clearTimeout(wahaDebounceRef.current);
      wahaDebounceRef.current = setTimeout(() => {
        wahaDebounceRef.current = null;
        dispatchDashboardWahaMetadataRefresh();
      }, WAHA_METADATA_REFRESH_DEBOUNCE_MS);
    };

    const maybeShowToast = () => {
      if (toastRef.current) return;
      toastRef.current = true;
      toast.info("Neue Nachricht", {
        description: "Posteingang wird aktualisiert.",
        duration: 4_000,
      });
      setTimeout(() => {
        toastRef.current = false;
      }, RECONCILE_REFRESH_DEBOUNCE_MS);
    };

    const onInboundInsert = () => {
      burstCountRef.current += 1;
      if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
      burstTimerRef.current = setTimeout(() => {
        burstTimerRef.current = null;
        const count = burstCountRef.current;
        burstCountRef.current = 0;
        if (count >= BULK_INSERT_THRESHOLD) {
          scheduleReconcile();
          return;
        }
        if (count === 1) {
          maybeShowToast();
        }
        scheduleReconcile();
      }, INSERT_BURST_WINDOW_MS);
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
        const row = payload.new;
        if (row.direction !== "inbound") return;

        const mapped = mapContactMessageRowFromRecord(row);
        applyInboundMessageToInboxCache(restaurantId, mapped);
        onInboundInsert();
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
          onInboundInsert();
        } else if (source === "waha_ack") {
          scheduleWahaMetadataRefresh();
        }
      },
    });

    return () => {
      window.clearTimeout(readyTimeout);
      if (reconcileRef.current) {
        clearTimeout(reconcileRef.current);
        reconcileRef.current = null;
      }
      if (wahaDebounceRef.current) {
        clearTimeout(wahaDebounceRef.current);
        wahaDebounceRef.current = null;
      }
      if (burstTimerRef.current) {
        clearTimeout(burstTimerRef.current);
        burstTimerRef.current = null;
      }
      polling.stop();
      teardownMessages();
      teardownSignals();
    };
  }, [enabled, ready, restaurantId, polling.start, polling.stop]);
}

/** @deprecated Alias — nutze {@link useInboxLiveNotifications}. */
export const useDashboardLiveNotifications = useInboxLiveNotifications;

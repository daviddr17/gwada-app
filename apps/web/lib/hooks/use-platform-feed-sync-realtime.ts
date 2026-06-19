"use client";

import { useEffect, useRef } from "react";
import { useVisibleIntervalPolling } from "@/lib/hooks/use-visible-interval-polling";
import { isPublicSupabaseProxyEnabled } from "@/lib/public-env";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  subscribeRestaurantTableChanges,
  type RestaurantRealtimeTable,
} from "@/lib/supabase/restaurant-table-realtime";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";

const REALTIME_READY_TIMEOUT_MS = 12_000;
const FALLBACK_POLL_MS = 60_000;

/**
 * Feed-Sync abgeschlossen (UPDATE auf Sync-Tabelle) → leiser Reload.
 * Ersetzt 5s-Polling während externer Kanäle synchronisieren.
 */
export function usePlatformFeedSyncRealtime(
  table: Extract<
    RestaurantRealtimeTable,
    | "restaurant_news_platform_sync"
    | "restaurant_news_stories_sync"
    | "restaurant_reviews_platform_sync"
    | "restaurant_events_platform_sync"
  >,
  onSyncComplete: () => void,
  options?: { enabled?: boolean; fallbackPollMs?: number },
) {
  const enabled = options?.enabled ?? true;
  const fallbackPollMs = options?.fallbackPollMs ?? FALLBACK_POLL_MS;
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const sbRef = useRef(createSupabaseBrowserClient());
  const onSyncRef = useRef(onSyncComplete);
  onSyncRef.current = onSyncComplete;
  const polling = useVisibleIntervalPolling(fallbackPollMs);
  const liveRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (!ready || !restaurantId || !isUuidRestaurantId(restaurantId)) return;

    liveRef.current = false;

    const scheduleRefresh = () => {
      onSyncRef.current();
    };

    const enablePolling = () => {
      liveRef.current = false;
      polling.start(() => {
        if (document.visibilityState !== "visible") return;
        scheduleRefresh();
      });
    };

    const disablePolling = () => {
      liveRef.current = true;
      polling.stop();
    };

    if (isPublicSupabaseProxyEnabled()) {
      enablePolling();
      return () => polling.stop();
    }

    const readyTimeout = window.setTimeout(() => {
      if (!liveRef.current) enablePolling();
    }, REALTIME_READY_TIMEOUT_MS);

    const teardown = subscribeRestaurantTableChanges(sbRef.current, {
      channelName: `${table}-live:${restaurantId}`,
      table,
      restaurantId,
      events: ["UPDATE"],
      onChange: () => {
        scheduleRefresh();
      },
      onStatus: (status) => {
        if (status === "SUBSCRIBED") {
          disablePolling();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          enablePolling();
        } else if (status === "CLOSED") {
          enablePolling();
        }
      },
    });

    return () => {
      window.clearTimeout(readyTimeout);
      polling.stop();
      teardown();
    };
  }, [enabled, ready, restaurantId, table, polling.start, polling.stop, fallbackPollMs]);
}

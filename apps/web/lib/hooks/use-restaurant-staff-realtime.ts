"use client";

import { useEffect, useRef } from "react";
import { dispatchStaffDataRefresh } from "@/lib/staff/staff-live-events";
import { useVisibleIntervalPolling } from "@/lib/hooks/use-visible-interval-polling";
import { isPublicSupabaseProxyEnabled } from "@/lib/public-env";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { subscribeRestaurantTableChanges } from "@/lib/supabase/restaurant-table-realtime";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";

const STAFF_POLL_MS = 30_000;
const REALTIME_READY_TIMEOUT_MS = 12_000;

/**
 * Mitarbeiter: Realtime; bei Ausfall oder `/sb`-Proxy Polling (30 s).
 */
export function useRestaurantStaffRealtime() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const sbRef = useRef(createSupabaseBrowserClient());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subscribedChannelsRef = useRef(0);
  const polling = useVisibleIntervalPolling(STAFF_POLL_MS);

  useEffect(() => {
    if (!ready || !restaurantId || !isUuidRestaurantId(restaurantId)) return;

    subscribedChannelsRef.current = 0;

    const scheduleRefresh = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        dispatchStaffDataRefresh();
      }, 400);
    };

    const enablePolling = () => {
      polling.start(() => {
        if (document.visibilityState !== "visible") return;
        dispatchStaffDataRefresh();
      });
    };

    const disablePolling = () => {
      polling.stop();
    };

    const onChannelStatus = (status: "SUBSCRIBED" | "CHANNEL_ERROR" | "TIMED_OUT" | "CLOSED") => {
      if (status === "SUBSCRIBED") {
        subscribedChannelsRef.current = Math.min(
          2,
          subscribedChannelsRef.current + 1,
        );
        if (subscribedChannelsRef.current >= 2) disablePolling();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        enablePolling();
      } else if (status === "CLOSED") {
        subscribedChannelsRef.current = Math.max(
          0,
          subscribedChannelsRef.current - 1,
        );
        if (subscribedChannelsRef.current < 2) enablePolling();
      }
    };

    if (isPublicSupabaseProxyEnabled()) {
      enablePolling();
    }

    const readyTimeout = window.setTimeout(() => {
      if (subscribedChannelsRef.current < 2) enablePolling();
    }, REALTIME_READY_TIMEOUT_MS);

    const teardownEntries = subscribeRestaurantTableChanges(sbRef.current, {
      channelName: `staff-work-entries-live:${restaurantId}`,
      table: "restaurant_staff_work_entries",
      restaurantId,
      events: ["INSERT", "UPDATE", "DELETE"],
      onChange: scheduleRefresh,
      onStatus: onChannelStatus,
    });

    const teardownStaff = subscribeRestaurantTableChanges(sbRef.current, {
      channelName: `staff-roster-live:${restaurantId}`,
      table: "restaurant_staff",
      restaurantId,
      events: ["INSERT", "UPDATE", "DELETE"],
      onChange: scheduleRefresh,
      onStatus: onChannelStatus,
    });

    return () => {
      window.clearTimeout(readyTimeout);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      disablePolling();
      teardownEntries();
      teardownStaff();
    };
  }, [ready, restaurantId, polling.start, polling.stop]);
}

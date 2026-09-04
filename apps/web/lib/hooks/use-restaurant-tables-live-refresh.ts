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
const REFRESH_DEBOUNCE_MS = 300;

/**
 * Zone-Level Realtime → Callback. Der Callback darf nur refetch/invalidate —
 * niemals Client-State in die DB zurückschreiben.
 */
export function useRestaurantTablesLiveRefresh(params: {
  tables: readonly RestaurantRealtimeTable[];
  channelPrefix: string;
  onRefresh: () => void;
  pollMs?: number;
}) {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const sbRef = useRef(createSupabaseBrowserClient());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subscribedChannelsRef = useRef(0);
  const onRefreshRef = useRef(params.onRefresh);
  onRefreshRef.current = params.onRefresh;
  const polling = useVisibleIntervalPolling(params.pollMs ?? 15_000);
  const tablesKey = params.tables.join(",");

  useEffect(() => {
    if (!ready || !restaurantId || !isUuidRestaurantId(restaurantId)) return;
    const tables = tablesKey.split(",") as RestaurantRealtimeTable[];
    if (tables.length === 0) return;

    subscribedChannelsRef.current = 0;
    const expectedChannels = tables.length;

    const fire = () => {
      onRefreshRef.current();
    };

    const scheduleRefresh = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        fire();
      }, REFRESH_DEBOUNCE_MS);
    };

    const enablePolling = () => {
      polling.start(() => {
        if (document.visibilityState !== "visible") return;
        fire();
      });
    };

    const disablePolling = () => {
      polling.stop();
    };

    const onChannelStatus = (
      status: "SUBSCRIBED" | "CHANNEL_ERROR" | "TIMED_OUT" | "CLOSED",
    ) => {
      if (status === "SUBSCRIBED") {
        subscribedChannelsRef.current = Math.min(
          expectedChannels,
          subscribedChannelsRef.current + 1,
        );
        if (subscribedChannelsRef.current >= expectedChannels) disablePolling();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        enablePolling();
      } else if (status === "CLOSED") {
        subscribedChannelsRef.current = Math.max(
          0,
          subscribedChannelsRef.current - 1,
        );
        if (subscribedChannelsRef.current < expectedChannels) enablePolling();
      }
    };

    if (isPublicSupabaseProxyEnabled()) {
      enablePolling();
    }

    const readyTimeout = window.setTimeout(() => {
      if (subscribedChannelsRef.current < expectedChannels) enablePolling();
    }, REALTIME_READY_TIMEOUT_MS);

    const teardowns = tables.map((table) =>
      subscribeRestaurantTableChanges(sbRef.current, {
        channelName: `${params.channelPrefix}-${table}:${restaurantId}`,
        table,
        restaurantId,
        events: ["INSERT", "UPDATE", "DELETE"],
        onChange: scheduleRefresh,
        onStatus: onChannelStatus,
      }),
    );

    return () => {
      window.clearTimeout(readyTimeout);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      disablePolling();
      for (const teardown of teardowns) teardown();
    };
  }, [
    ready,
    restaurantId,
    tablesKey,
    params.channelPrefix,
    polling.start,
    polling.stop,
  ]);
}

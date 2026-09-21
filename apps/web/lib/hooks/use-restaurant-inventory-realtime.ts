"use client";

import { useEffect, useRef } from "react";
import { dispatchInventoryDataRefresh } from "@/lib/inventory/inventory-live-events";
import { useVisibleIntervalPolling } from "@/lib/hooks/use-visible-interval-polling";
import { isPublicSupabaseProxyEnabled } from "@/lib/public-env";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { subscribeRestaurantTableChanges } from "@/lib/supabase/restaurant-table-realtime";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";

const INVENTORY_POLL_MS = 15_000;
const REALTIME_READY_TIMEOUT_MS = 12_000;
const REFRESH_DEBOUNCE_MS = 300;

/**
 * Bestand/Bestellungen: Realtime über Live-Signal + Tabellen-Fallback; bei Ausfall Polling (15 s).
 * Zone-Level in AppModuleLiveProviders — nicht pro Route mounten.
 */
export function useRestaurantInventoryRealtime() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const sbRef = useRef(createSupabaseBrowserClient());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subscribedChannelsRef = useRef(0);
  const polling = useVisibleIntervalPolling(INVENTORY_POLL_MS);

  useEffect(() => {
    if (!ready || !restaurantId || !isUuidRestaurantId(restaurantId)) return;

    subscribedChannelsRef.current = 0;
    const expectedChannels = 3;

    const scheduleRefresh = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        dispatchInventoryDataRefresh();
      }, REFRESH_DEBOUNCE_MS);
    };

    const enablePolling = () => {
      polling.start(() => {
        if (document.visibilityState !== "visible") return;
        dispatchInventoryDataRefresh();
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

    const teardownSignal = subscribeRestaurantTableChanges(sbRef.current, {
      channelName: `inventory-live-signal:${restaurantId}`,
      table: "restaurant_inventory_live_signals",
      restaurantId,
      events: ["INSERT", "UPDATE"],
      onChange: scheduleRefresh,
      onStatus: onChannelStatus,
    });

    const teardownIngredients = subscribeRestaurantTableChanges(sbRef.current, {
      channelName: `inventory-ingredients-live:${restaurantId}`,
      table: "inventory_ingredients",
      restaurantId,
      events: ["INSERT", "UPDATE", "DELETE"],
      onChange: scheduleRefresh,
      onStatus: onChannelStatus,
    });

    const teardownPurchaseOrders = subscribeRestaurantTableChanges(sbRef.current, {
      channelName: `inventory-purchase-orders-live:${restaurantId}`,
      table: "inventory_purchase_orders",
      restaurantId,
      events: ["INSERT", "UPDATE", "DELETE"],
      onChange: scheduleRefresh,
      onStatus: onChannelStatus,
    });

    return () => {
      window.clearTimeout(readyTimeout);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      disablePolling();
      teardownSignal();
      teardownIngredients();
      teardownPurchaseOrders();
    };
  }, [ready, restaurantId, polling.start, polling.stop]);
}

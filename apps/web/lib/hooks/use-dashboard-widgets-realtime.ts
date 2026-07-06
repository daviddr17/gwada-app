"use client";

import { useEffect, useRef } from "react";
import type {
  DashboardWidgetLiveFetchId,
} from "@/lib/dashboard/dashboard-widget-live-config";
import { dispatchDashboardWidgetLiveFetch } from "@/lib/dashboard/dashboard-widgets-live-events";
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
const REFRESH_DEBOUNCE_MS = 400;

type WidgetSubscription = {
  widget: DashboardWidgetLiveFetchId;
  table: RestaurantRealtimeTable;
  events?: ("INSERT" | "UPDATE" | "DELETE")[];
};

const WIDGET_SUBSCRIPTIONS: WidgetSubscription[] = [
  { widget: "menu", table: "menu_items" },
  { widget: "menu", table: "menu_categories" },
  { widget: "menu", table: "menu_main_categories" },
  { widget: "contacts", table: "contacts" },
  { widget: "inventory", table: "inventory_ingredients" },
  { widget: "inventory", table: "inventory_purchase_orders" },
  { widget: "reviews", table: "restaurant_reviews_platform_sync", events: ["UPDATE"] },
  { widget: "integrations", table: "restaurant_integrations" },
];

/**
 * Dashboard-KPIs: Realtime pro Widget-Tabelle → debounced Live-Fetch/Patch.
 */
export function useDashboardWidgetsRealtime() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const sbRef = useRef(createSupabaseBrowserClient());
  const debounceRef = useRef<Map<DashboardWidgetLiveFetchId, number>>(new Map());
  const subscribedRef = useRef(0);
  const polling = useVisibleIntervalPolling(FALLBACK_POLL_MS);

  useEffect(() => {
    if (!ready || !restaurantId || !isUuidRestaurantId(restaurantId)) return;

    subscribedRef.current = 0;
    const expectedChannels = WIDGET_SUBSCRIPTIONS.length;

    const scheduleWidgetFetch = (widget: DashboardWidgetLiveFetchId) => {
      const existing = debounceRef.current.get(widget);
      if (existing) window.clearTimeout(existing);
      const id = window.setTimeout(() => {
        debounceRef.current.delete(widget);
        dispatchDashboardWidgetLiveFetch(restaurantId, widget);
      }, REFRESH_DEBOUNCE_MS);
      debounceRef.current.set(widget, id);
    };

    const enablePolling = () => {
      polling.start(() => {
        if (document.visibilityState !== "visible") return;
        for (const widget of new Set(
          WIDGET_SUBSCRIPTIONS.map((s) => s.widget),
        )) {
          dispatchDashboardWidgetLiveFetch(restaurantId, widget);
        }
      });
    };

    const disablePolling = () => {
      polling.stop();
    };

    const onChannelStatus = (
      status: "SUBSCRIBED" | "CHANNEL_ERROR" | "TIMED_OUT" | "CLOSED",
    ) => {
      if (status === "SUBSCRIBED") {
        subscribedRef.current = Math.min(
          expectedChannels,
          subscribedRef.current + 1,
        );
        if (subscribedRef.current >= expectedChannels) disablePolling();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        enablePolling();
      } else if (status === "CLOSED") {
        subscribedRef.current = Math.max(0, subscribedRef.current - 1);
        if (subscribedRef.current < expectedChannels) enablePolling();
      }
    };

    if (isPublicSupabaseProxyEnabled()) {
      enablePolling();
    }

    const readyTimeout = window.setTimeout(() => {
      if (subscribedRef.current < expectedChannels) enablePolling();
    }, REALTIME_READY_TIMEOUT_MS);

    const teardowns = WIDGET_SUBSCRIPTIONS.map((sub) =>
      subscribeRestaurantTableChanges(sbRef.current, {
        channelName: `dashboard-${sub.widget}-${sub.table}:${restaurantId}`,
        table: sub.table,
        restaurantId,
        events: sub.events ?? ["INSERT", "UPDATE", "DELETE"],
        onChange: () => scheduleWidgetFetch(sub.widget),
        onStatus: onChannelStatus,
      }),
    );

    return () => {
      window.clearTimeout(readyTimeout);
      for (const id of debounceRef.current.values()) {
        window.clearTimeout(id);
      }
      debounceRef.current.clear();
      disablePolling();
      for (const teardown of teardowns) teardown();
    };
  }, [ready, restaurantId, polling.start, polling.stop]);
}

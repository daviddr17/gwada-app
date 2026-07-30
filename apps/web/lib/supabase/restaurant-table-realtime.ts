import type {
  RealtimeChannel,
  SupabaseClient,
} from "@supabase/supabase-js";
import {
  registerRestaurantRealtimeSubscription,
  type RestaurantRealtimeSubscription,
} from "@/lib/supabase/restaurant-realtime-visibility-coordinator";

export type RestaurantRealtimeTable =
  | "reservations"
  | "contact_messages"
  | "restaurant_inbox_signals"
  | "restaurant_staff_work_entries"
  | "restaurant_staff"
  | "notification_events"
  | "restaurant_news_platform_sync"
  | "restaurant_news_stories_sync"
  | "restaurant_reviews_platform_sync"
  | "restaurant_events_platform_sync"
  | "inventory_ingredients"
  | "inventory_purchase_orders"
  | "menu_items"
  | "menu_categories"
  | "menu_main_categories"
  | "contacts"
  | "restaurant_integrations";

type RealtimeChangeEvent = "INSERT" | "UPDATE" | "DELETE";

export type RestaurantRealtimeSubscribeStatus =
  | "SUBSCRIBED"
  | "CHANNEL_ERROR"
  | "TIMED_OUT"
  | "CLOSED";

function realtimeTopic(channelName: string): string {
  return `realtime:${channelName}`;
}

/**
 * Entfernt hängende Kanäle gleichen Namens vor Resubscribe.
 * Pflicht bei Soft-Nav — sonst uncaught Realtime-Fehler bei schnellem Modulwechsel.
 * Siehe `.cursor/rules/app-realtime-soft-nav.mdc`.
 */
function removeChannelsByName(sb: SupabaseClient, channelName: string): void {
  const topic = realtimeTopic(channelName);
  for (const existing of sb.getChannels()) {
    if (existing.topic === topic) {
      void sb.removeChannel(existing);
    }
  }
}

/**
 * Postgres-Changes für ein Restaurant — Filter clientseitig (zuverlässiger als
 * `filter: restaurant_id=eq.…` ohne REPLICA IDENTITY FULL).
 */
export function subscribeRestaurantTableChanges(
  sb: SupabaseClient,
  options: {
    channelName: string;
    table: RestaurantRealtimeTable;
    restaurantId: string;
    events?: RealtimeChangeEvent[];
    onChange: (payload: {
      eventType: RealtimeChangeEvent;
      new: Record<string, unknown>;
      old: Record<string, unknown>;
    }) => void;
    /** Status für Polling-Fallback, wenn Realtime nicht verbindet. */
    onStatus?: (status: RestaurantRealtimeSubscribeStatus) => void;
  },
): () => void {
  const events = options.events ?? ["INSERT"];

  let channel: RealtimeChannel | null = null;
  let subscribing = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  /** CLOSED von Replace/Teardown — kein Polling-Sturm (besonders nach Tab-Idle). */
  let suppressClosedUntil = 0;

  const clearRetry = () => {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  };

  const suppressClosedBriefly = () => {
    suppressClosedUntil = Date.now() + 2_500;
  };

  const shouldNotifyClosed = () => {
    if (document.visibilityState !== "visible") return false;
    if (Date.now() < suppressClosedUntil) return false;
    return true;
  };

  const matchesRestaurant = (row: { restaurant_id?: string } | undefined) =>
    row?.restaurant_id === options.restaurantId;

  const subscribe = () => {
    if (subscribing || document.visibilityState !== "visible") {
      return;
    }

    suppressClosedBriefly();
    removeChannelsByName(sb, options.channelName);
    channel = null;

    subscribing = true;

    try {
      let ch = sb.channel(options.channelName);

      for (const event of events) {
        ch = ch.on(
          "postgres_changes",
          {
            event,
            schema: "public",
            table: options.table,
          },
          (payload) => {
            const eventType = payload.eventType as RealtimeChangeEvent;
            const row =
              eventType === "DELETE"
                ? (payload.old as { restaurant_id?: string } | undefined)
                : (payload.new as { restaurant_id?: string } | undefined);
            if (!matchesRestaurant(row)) return;
            options.onChange({
              eventType,
              new: (payload.new ?? {}) as Record<string, unknown>,
              old: (payload.old ?? {}) as Record<string, unknown>,
            });
          },
        );
      }

      ch.subscribe((status, err) => {
        subscribing = false;
        if (status === "SUBSCRIBED") {
          channel = ch;
          options.onStatus?.("SUBSCRIBED");
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn(
            `[gwada] realtime ${options.channelName}:`,
            status,
            err?.message ?? "",
          );
          options.onStatus?.(status);
          suppressClosedBriefly();
          void sb.removeChannel(ch);
          channel = null;
          clearRetry();
          if (document.visibilityState === "visible") {
            retryTimer = setTimeout(subscribe, 3_000);
          }
          return;
        }
        if (status === "CLOSED") {
          channel = null;
          if (shouldNotifyClosed()) {
            options.onStatus?.("CLOSED");
          }
        }
      });
    } catch (err) {
      subscribing = false;
      channel = null;
      console.warn(`[gwada] realtime ${options.channelName}: subscribe failed`, err);
      options.onStatus?.("CHANNEL_ERROR");
      clearRetry();
      if (document.visibilityState === "visible") {
        retryTimer = setTimeout(subscribe, 3_000);
      }
    }
  };

  const unsubscribe = () => {
    clearRetry();
    subscribing = false;
    // Intentional pause (Tab-Idle) / Unmount / Replace — CLOSED unterdrücken,
    // sonst starten alle Hooks sofort Fallback-Polling (Klick-Freeze nach Tab-Rückkehr).
    suppressClosedBriefly();
    if (channel) {
      void sb.removeChannel(channel);
      channel = null;
    }
    removeChannelsByName(sb, options.channelName);
  };

  const subscription: RestaurantRealtimeSubscription = {
    channelName: options.channelName,
    connected: false,
    subscribe,
    unsubscribe,
  };

  return registerRestaurantRealtimeSubscription(subscription);
}

/** @deprecated Nutze {@link subscribeRestaurantTableChanges} — nur INSERT. */
export function subscribeRestaurantTableInserts(
  sb: SupabaseClient,
  options: {
    channelName: string;
    table: RestaurantRealtimeTable;
    restaurantId: string;
    onInsert: (payload: { new: Record<string, unknown> }) => void;
    onStatus?: (status: RestaurantRealtimeSubscribeStatus) => void;
  },
): () => void {
  return subscribeRestaurantTableChanges(sb, {
    channelName: options.channelName,
    table: options.table,
    restaurantId: options.restaurantId,
    events: ["INSERT"],
    onChange: ({ new: row }) => options.onInsert({ new: row }),
    onStatus: options.onStatus,
  });
}

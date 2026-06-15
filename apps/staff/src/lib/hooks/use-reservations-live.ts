import { useQueryClient } from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { getStaffSupabase } from "@/src/lib/supabase";

const POLL_MS = 60_000;

function uniqueChannelSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useReservationsLive(restaurantId: string | null | undefined) {
  const queryClient = useQueryClient();
  const [realtimeOk, setRealtimeOk] = useState(false);

  useEffect(() => {
    if (!restaurantId) {
      setRealtimeOk(false);
      return;
    }

    const sb = getStaffSupabase();
    let channel: RealtimeChannel | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let subscribing = false;

    const invalidate = () => {
      void queryClient.invalidateQueries({
        queryKey: ["reservations-overview", restaurantId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["dining-floor", restaurantId],
      });
    };

    const clearRetry = () => {
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    };

    const removeChannel = (ch: RealtimeChannel | null) => {
      if (!ch) return;
      void sb.removeChannel(ch);
    };

    const unsubscribe = () => {
      clearRetry();
      subscribing = false;
      removeChannel(channel);
      channel = null;
      setRealtimeOk(false);
    };

    const matchesRestaurant = (row: { restaurant_id?: string } | undefined) =>
      row?.restaurant_id === restaurantId;

    const subscribe = () => {
      if (channel || subscribing || AppState.currentState !== "active") {
        return;
      }

      subscribing = true;
      const ch = sb
        .channel(`staff-reservations-${restaurantId}-${uniqueChannelSuffix()}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "reservations" },
          (payload) => {
            const row = payload.new as { restaurant_id?: string } | undefined;
            if (!matchesRestaurant(row)) return;
            invalidate();
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "reservations" },
          (payload) => {
            const row = payload.new as { restaurant_id?: string } | undefined;
            if (!matchesRestaurant(row)) return;
            invalidate();
          },
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "reservations" },
          (payload) => {
            const row = payload.old as { restaurant_id?: string } | undefined;
            if (!matchesRestaurant(row)) return;
            invalidate();
          },
        );

      channel = ch;

      ch.subscribe((status) => {
        subscribing = false;
        if (status === "SUBSCRIBED") {
          setRealtimeOk(true);
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setRealtimeOk(false);
          if (channel === ch) {
            removeChannel(ch);
            channel = null;
          }
          clearRetry();
          if (AppState.currentState === "active") {
            retryTimer = setTimeout(subscribe, 3_000);
          }
        }
      });
    };

    const onAppState = (nextState: string) => {
      if (nextState === "active") {
        subscribe();
      } else {
        unsubscribe();
      }
    };

    subscribe();
    const appStateSub = AppState.addEventListener("change", onAppState);

    return () => {
      appStateSub.remove();
      unsubscribe();
    };
  }, [queryClient, restaurantId]);

  return {
    refetchInterval: realtimeOk ? (false as const) : POLL_MS,
  };
}

"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  dispatchDashboardReservationsLiveInsert,
  dispatchDashboardReservationsLiveUpdate,
} from "@/lib/dashboard/dashboard-live-events";
import {
  reservationLiveInsertFromRecord,
} from "@/lib/dashboard/patch-dashboard-reservations-live-client";
import type { ReservationLiveToastFields } from "@/lib/reservations/reservation-live-toast";
import {
  reservationLiveToastFromRecord,
  showNewReservationToast,
} from "@/lib/reservations/reservation-live-toast";
import type { ReservationsLiveSignal } from "@/lib/reservations/reservations-live-signal";
import { useWorkspaceAuthSession } from "@/lib/contexts/workspace-auth-session-context";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { useVisibleIntervalPolling } from "@/lib/hooks/use-visible-interval-polling";
import { isPublicSupabaseProxyEnabled } from "@/lib/public-env";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { subscribeRestaurantTableChanges } from "@/lib/supabase/restaurant-table-realtime";

const PLATFORM_POLL_MS = 60_000;
const REALTIME_READY_TIMEOUT_MS = 12_000;
const UPDATE_PATCH_DEBOUNCE_MS = 500;

/**
 * Reservierungen: Realtime INSERT + UPDATE; bei Ausfall oder `/sb`-Proxy Polling (60 s).
 */
export function usePlatformReservationsLive() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const { user, ready: authReady } = useWorkspaceAuthSession();
  const hasUserRef = useRef(Boolean(user));
  const toastRef = useRef(false);
  const lastSignalRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const realtimeSubscribedRef = useRef(false);
  const updateDebounceRef = useRef<number | null>(null);
  const sbRef = useRef(createSupabaseBrowserClient());
  const polling = useVisibleIntervalPolling(PLATFORM_POLL_MS);

  useEffect(() => {
    hasUserRef.current = Boolean(user);
  }, [user]);

  const canReceive =
    authReady &&
    ready &&
    hasUserRef.current &&
    Boolean(restaurantId) &&
    isUuidRestaurantId(restaurantId!);

  const scheduleUpdatePatch = useCallback(() => {
    if (!restaurantId) return;
    if (updateDebounceRef.current) {
      window.clearTimeout(updateDebounceRef.current);
    }
    updateDebounceRef.current = window.setTimeout(() => {
      updateDebounceRef.current = null;
      dispatchDashboardReservationsLiveUpdate({ restaurantId });
    }, UPDATE_PATCH_DEBOUNCE_MS);
  }, [restaurantId]);

  const notifyNewReservation = useCallback(
    (
      row: ReservationLiveToastFields | null,
      raw?: Record<string, unknown>,
    ) => {
      if (!toastRef.current) {
        toastRef.current = true;
        showNewReservationToast(row);
        setTimeout(() => {
          toastRef.current = false;
        }, 2_000);
      }
      if (restaurantId && raw) {
        const insert = reservationLiveInsertFromRecord(raw);
        if (insert) {
          dispatchDashboardReservationsLiveInsert({ restaurantId, insert });
          return;
        }
      }
      scheduleUpdatePatch();
    },
    [restaurantId, scheduleUpdatePatch],
  );

  const handleLiveSignal = useCallback(
    (signal: ReservationsLiveSignal) => {
      const latest = signal.latestCreatedAt;
      if (!latest) return;
      if (!initializedRef.current) {
        initializedRef.current = true;
        lastSignalRef.current = latest;
        return;
      }
      if (lastSignalRef.current && latest !== lastSignalRef.current) {
        notifyNewReservation(signal.latest, undefined);
      }
      lastSignalRef.current = latest;
    },
    [notifyNewReservation],
  );

  useEffect(() => {
    if (!canReceive || !restaurantId) return;

    initializedRef.current = false;
    lastSignalRef.current = null;
    realtimeSubscribedRef.current = false;

    const enablePolling = () => {
      polling.start(async () => {
        if (document.visibilityState !== "visible") return;
        try {
          const res = await fetch(
            `/api/dashboard/reservations/live-signal?restaurantId=${encodeURIComponent(restaurantId)}`,
            { cache: "no-store", credentials: "include" },
          );
          if (!res.ok) return;
          const body = (await res.json()) as ReservationsLiveSignal;
          handleLiveSignal(body);
        } catch {
          /* Fallback-Polling */
        }
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

    const teardownRealtime = subscribeRestaurantTableChanges(sbRef.current, {
      channelName: `platform-reservations-live:${restaurantId}`,
      table: "reservations",
      restaurantId,
      events: ["INSERT", "UPDATE"],
      onStatus: (status) => {
        if (status === "SUBSCRIBED") {
          realtimeSubscribedRef.current = true;
          disablePolling();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          enablePolling();
        }
      },
      onChange: ({ eventType, new: row }) => {
        if (eventType === "INSERT") {
          notifyNewReservation(reservationLiveToastFromRecord(row), row);
          return;
        }
        scheduleUpdatePatch();
      },
    });

    return () => {
      window.clearTimeout(readyTimeout);
      if (updateDebounceRef.current) {
        window.clearTimeout(updateDebounceRef.current);
      }
      disablePolling();
      teardownRealtime();
    };
  }, [
    canReceive,
    restaurantId,
    handleLiveSignal,
    notifyNewReservation,
    scheduleUpdatePatch,
    polling.start,
    polling.stop,
  ]);
}

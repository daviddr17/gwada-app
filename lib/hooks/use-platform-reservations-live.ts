"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { dispatchDashboardReservationsRefresh } from "@/lib/dashboard/dashboard-live-events";
import type { ReservationLiveToastFields } from "@/lib/reservations/reservation-live-toast";
import {
  reservationLiveToastFromRecord,
  showNewReservationToast,
} from "@/lib/reservations/reservation-live-toast";
import type { ReservationsLiveSignal } from "@/lib/reservations/reservations-live-signal";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { useVisibleIntervalPolling } from "@/lib/hooks/use-visible-interval-polling";
import { isPublicSupabaseProxyEnabled } from "@/lib/public-env";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { subscribeRestaurantTableInserts } from "@/lib/supabase/restaurant-table-realtime";

const PLATFORM_POLL_MS = 60_000;
const REALTIME_READY_TIMEOUT_MS = 12_000;

/**
 * Neue Reservierungen: Realtime; bei Ausfall oder `/sb`-Proxy Polling (60 s).
 * Display: {@link useDisplayReservationsLive}.
 */
export function usePlatformReservationsLive() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const [authReady, setAuthReady] = useState(false);
  const hasUserRef = useRef(false);
  const toastRef = useRef(false);
  const lastSignalRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const realtimeSubscribedRef = useRef(false);
  const sbRef = useRef(createSupabaseBrowserClient());
  const polling = useVisibleIntervalPolling(PLATFORM_POLL_MS);

  useEffect(() => {
    const sb = sbRef.current;
    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((_event, session) => {
      hasUserRef.current = Boolean(session?.user);
      setAuthReady(true);
    });
    void sb.auth.getUser().then(({ data: { user } }) => {
      hasUserRef.current = Boolean(user);
      setAuthReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const canReceive =
    authReady &&
    ready &&
    hasUserRef.current &&
    Boolean(restaurantId) &&
    isUuidRestaurantId(restaurantId!);

  const notifyNewReservation = useCallback(
    (row: ReservationLiveToastFields | null) => {
      if (!toastRef.current) {
        toastRef.current = true;
        showNewReservationToast(row);
        setTimeout(() => {
          toastRef.current = false;
        }, 2_000);
      }
      dispatchDashboardReservationsRefresh();
    },
    [],
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
        notifyNewReservation(signal.latest);
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

    const teardownRealtime = subscribeRestaurantTableInserts(sbRef.current, {
      channelName: `platform-reservations-live:${restaurantId}`,
      table: "reservations",
      restaurantId,
      onStatus: (status) => {
        if (status === "SUBSCRIBED") {
          realtimeSubscribedRef.current = true;
          disablePolling();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          enablePolling();
        }
      },
      onInsert: (payload) => {
        notifyNewReservation(reservationLiveToastFromRecord(payload.new));
      },
    });

    return () => {
      window.clearTimeout(readyTimeout);
      disablePolling();
      teardownRealtime();
    };
  }, [
    canReceive,
    restaurantId,
    handleLiveSignal,
    notifyNewReservation,
    polling.start,
    polling.stop,
  ]);
}

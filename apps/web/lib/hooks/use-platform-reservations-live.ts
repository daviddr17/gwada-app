"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  dispatchDashboardReservationsLiveInsert,
  dispatchDashboardReservationsLiveUpdate,
  GWADA_PLATFORM_RESERVATIONS_OWN_CREATE_EVENT,
  type PlatformReservationsOwnCreateDetail,
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
import { useRestaurantIanaTimezone } from "@/lib/hooks/use-restaurant-iana-timezone";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { useVisibleIntervalPolling } from "@/lib/hooks/use-visible-interval-polling";
import { isPublicSupabaseProxyEnabled } from "@/lib/public-env";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { subscribeRestaurantTableChanges } from "@/lib/supabase/restaurant-table-realtime";

const PLATFORM_POLL_MS = 60_000;
const REALTIME_READY_TIMEOUT_MS = 12_000;
const UPDATE_PATCH_DEBOUNCE_MS = 500;
const OWN_CREATE_SUPPRESS_MS = 15_000;

/**
 * Reservierungen: Realtime INSERT + UPDATE; bei Ausfall oder `/sb`-Proxy Polling (60 s).
 * Eigene Anlagen (Drawer/Sprache) unterdrücken den blauen „Neue Reservierung“-Toast.
 */
export function usePlatformReservationsLive() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const restaurantTimeZone = useRestaurantIanaTimezone(restaurantId);
  const { user, ready: authReady } = useWorkspaceAuthSession();
  const hasUserRef = useRef(Boolean(user));
  const userIdRef = useRef<string | null>(user?.id ?? null);
  const toastRef = useRef(false);
  const lastSignalRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const realtimeSubscribedRef = useRef(false);
  const updateDebounceRef = useRef<number | null>(null);
  const ownCreateIdsRef = useRef(new Set<string>());
  const ownCreateTimersRef = useRef(new Map<string, number>());
  const sbRef = useRef(createSupabaseBrowserClient());
  const polling = useVisibleIntervalPolling(PLATFORM_POLL_MS);

  useEffect(() => {
    hasUserRef.current = Boolean(user);
    userIdRef.current = user?.id ?? null;
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

  const isOwnCreate = useCallback(
    (raw?: Record<string, unknown>, reservationId?: string | null) => {
      const id =
        reservationId ??
        (typeof raw?.id === "string" ? raw.id : null);
      if (id && ownCreateIdsRef.current.has(id)) return true;
      const actor =
        typeof raw?.created_by_profile_id === "string"
          ? raw.created_by_profile_id
          : null;
      const me = userIdRef.current;
      return Boolean(actor && me && actor === me);
    },
    [],
  );

  const notifyNewReservation = useCallback(
    (
      row: ReservationLiveToastFields | null,
      raw?: Record<string, unknown>,
      options?: { reservationId?: string | null },
    ) => {
      const own = isOwnCreate(raw, options?.reservationId);
      if (!own && !toastRef.current) {
        toastRef.current = true;
        showNewReservationToast(row, restaurantTimeZone);
        setTimeout(() => {
          toastRef.current = false;
        }, 2_000);
      }
      // Eigene Anlage wurde schon optimistisch gepatcht — kein zweites Insert-Event.
      if (own) return;
      if (restaurantId && raw) {
        const insert = reservationLiveInsertFromRecord(raw);
        if (insert) {
          dispatchDashboardReservationsLiveInsert({ restaurantId, insert });
          return;
        }
      }
      scheduleUpdatePatch();
    },
    [restaurantId, restaurantTimeZone, scheduleUpdatePatch, isOwnCreate],
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
        // Polling liefert kein Realtime-`raw` — trotzdem LIVE_INSERT, sonst
        // Toast/Glocke ja, Tagesliste/KPIs bleiben stehen.
        notifyNewReservation(signal.latest, signal.latestRaw ?? undefined, {
          reservationId: signal.latestId,
        });
      }
      lastSignalRef.current = latest;
    },
    [notifyNewReservation],
  );

  useEffect(() => {
    const onOwnCreate = (event: Event) => {
      const detail = (event as CustomEvent<PlatformReservationsOwnCreateDetail>)
        .detail;
      if (!detail?.reservationId) return;
      ownCreateIdsRef.current.add(detail.reservationId);
      const prev = ownCreateTimersRef.current.get(detail.reservationId);
      if (prev) window.clearTimeout(prev);
      ownCreateTimersRef.current.set(
        detail.reservationId,
        window.setTimeout(() => {
          ownCreateIdsRef.current.delete(detail.reservationId);
          ownCreateTimersRef.current.delete(detail.reservationId);
        }, OWN_CREATE_SUPPRESS_MS),
      );
    };
    window.addEventListener(
      GWADA_PLATFORM_RESERVATIONS_OWN_CREATE_EVENT,
      onOwnCreate,
    );
    return () => {
      window.removeEventListener(
        GWADA_PLATFORM_RESERVATIONS_OWN_CREATE_EVENT,
        onOwnCreate,
      );
      for (const timer of ownCreateTimersRef.current.values()) {
        window.clearTimeout(timer);
      }
      ownCreateTimersRef.current.clear();
      ownCreateIdsRef.current.clear();
    };
  }, []);

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

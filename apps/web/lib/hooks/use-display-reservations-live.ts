"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  dispatchDisplayReservationsLiveInsert,
  dispatchDisplayReservationsRefresh,
  GWADA_DISPLAY_RESERVATIONS_LIVE_SYNC_EVENT,
} from "@/lib/display/display-reservations-live-events";
import type { DisplayReservationRow } from "@/lib/display/display-reservations-server";
import { showNewReservationToast } from "@/lib/reservations/reservation-live-toast";
import { reservationLiveToastFromRecord } from "@/lib/reservations/reservation-live-toast";

const DISPLAY_LIVE_POLL_MS = 2_000;
const RECONCILE_DEBOUNCE_MS = 2_500;

type DisplayLiveSnapshot = {
  revision: string;
  latestCreatedAt: string | null;
  latestUpdatedAt: string | null;
  latest: DisplayReservationRow | null;
};

/**
 * Display ohne Supabase-User: schnelles Live-Signal (2 s) + optimistischer Patch,
 * stille Reconciliation debounced — INSERT und UPDATE (Status/Tisch).
 */
export function useDisplayReservationsLive(enabled: boolean) {
  const lastRevisionRef = useRef<string | null>(null);
  const lastCreatedRef = useRef<string | null>(null);
  const toastRef = useRef(false);
  const initializedRef = useRef(false);
  const reconcileRef = useRef<number | null>(null);

  const scheduleReconcile = useCallback(() => {
    if (reconcileRef.current) {
      window.clearTimeout(reconcileRef.current);
    }
    reconcileRef.current = window.setTimeout(() => {
      reconcileRef.current = null;
      dispatchDisplayReservationsRefresh();
    }, RECONCILE_DEBOUNCE_MS);
  }, []);

  const handleSnapshot = useCallback(
    (snapshot: DisplayLiveSnapshot) => {
      const { revision, latestCreatedAt } = snapshot;

      if (!initializedRef.current) {
        initializedRef.current = true;
        lastRevisionRef.current = revision;
        lastCreatedRef.current = latestCreatedAt;
        return;
      }

      if (lastRevisionRef.current === revision) return;

      const isNewInsert =
        Boolean(latestCreatedAt) && latestCreatedAt !== lastCreatedRef.current;

      if (isNewInsert && snapshot.latest) {
        dispatchDisplayReservationsLiveInsert({
          row: snapshot.latest,
          latestCreatedAt: latestCreatedAt!,
        });
        if (!toastRef.current) {
          toastRef.current = true;
          showNewReservationToast(
            reservationLiveToastFromRecord({
              starts_at: snapshot.latest.starts_at,
              guest_first_name: snapshot.latest.guest_first_name,
              guest_last_name: snapshot.latest.guest_last_name,
              party_size: snapshot.latest.party_size,
            }),
          );
          window.setTimeout(() => {
            toastRef.current = false;
          }, 2_000);
        }
      }

      scheduleReconcile();
      lastRevisionRef.current = revision;
      lastCreatedRef.current = latestCreatedAt;
    },
    [scheduleReconcile],
  );

  useEffect(() => {
    if (!enabled) {
      lastRevisionRef.current = null;
      lastCreatedRef.current = null;
      initializedRef.current = false;
      return;
    }

    let cancelled = false;

    const tick = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/display/reservations/live-signal", {
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as DisplayLiveSnapshot;
        handleSnapshot(body);
      } catch {
        /* Hintergrund-Polling */
      }
    };

    const onPinSync = () => {
      initializedRef.current = false;
      lastRevisionRef.current = null;
      lastCreatedRef.current = null;
      void tick();
    };

    void tick();
    const id = window.setInterval(() => void tick(), DISPLAY_LIVE_POLL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener(
      GWADA_DISPLAY_RESERVATIONS_LIVE_SYNC_EVENT,
      onPinSync,
    );

    return () => {
      cancelled = true;
      window.clearInterval(id);
      if (reconcileRef.current) {
        window.clearTimeout(reconcileRef.current);
        reconcileRef.current = null;
      }
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(
        GWADA_DISPLAY_RESERVATIONS_LIVE_SYNC_EVENT,
        onPinSync,
      );
    };
  }, [enabled, handleSnapshot]);
}

"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  dispatchDisplayReservationsRefresh,
  GWADA_DISPLAY_RESERVATIONS_LIVE_SYNC_EVENT,
} from "@/lib/display/display-reservations-live-events";
import { showNewReservationToast } from "@/lib/reservations/reservation-live-toast";
import type { ReservationsLiveSignal } from "@/lib/reservations/reservations-live-signal";

const DISPLAY_POLL_MS = 60_000;

/**
 * Display ohne Supabase-User-Session: Polling auf live-signal (60 s).
 * Volle Tagesliste nur über {@link dispatchDisplayReservationsRefresh} (ein Kanal).
 */
export function useDisplayReservationsLive(enabled: boolean) {
  const lastSignalRef = useRef<string | null>(null);
  const toastRef = useRef(false);
  const initializedRef = useRef(false);

  const handleLiveSignal = useCallback((signal: ReservationsLiveSignal) => {
    const latest = signal.latestCreatedAt;
    if (!latest) return;

    if (!initializedRef.current) {
      initializedRef.current = true;
      lastSignalRef.current = latest;
      return;
    }

    if (lastSignalRef.current && latest !== lastSignalRef.current) {
      if (!toastRef.current) {
        toastRef.current = true;
        showNewReservationToast(signal.latest);
        setTimeout(() => {
          toastRef.current = false;
        }, 2_000);
      }
    }
    lastSignalRef.current = latest;
  }, []);

  useEffect(() => {
    if (!enabled) {
      lastSignalRef.current = null;
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
        const body = (await res.json()) as ReservationsLiveSignal;
        const hadBaseline = initializedRef.current;
        handleLiveSignal(body);
        if (hadBaseline) {
          dispatchDisplayReservationsRefresh();
        }
      } catch {
        /* Hintergrund-Polling */
      }
    };

    const onPinSync = () => {
      initializedRef.current = false;
      lastSignalRef.current = null;
      void tick();
    };

    void tick();
    const id = window.setInterval(() => void tick(), DISPLAY_POLL_MS);

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
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(
        GWADA_DISPLAY_RESERVATIONS_LIVE_SYNC_EVENT,
        onPinSync,
      );
    };
  }, [enabled, handleLiveSignal]);
}

"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  dispatchDisplayTodoBadgeSnapshot,
  GWADA_DISPLAY_TODOS_BADGE_SNAPSHOT_EVENT,
  GWADA_DISPLAY_TODOS_LIVE_SYNC_EVENT,
  type DisplayTodoBadgeSnapshot,
} from "@/lib/display/display-todos-live-events";
import type { DisplayTodosLiveSignal } from "@/lib/staff/display-todos-live-signal";
import { parseDisplayTodosLiveRevision } from "@/lib/staff/display-todos-live-signal";

const DISPLAY_TODOS_POLL_MS = 15_000;

/**
 * Display ohne Supabase-User-Session: Polling auf live-signal (15 s).
 * Badge über Snapshot aus der Revision — kein separater Refresh-Fetch.
 */
export function useDisplayTodosLive(enabled: boolean) {
  const lastRevisionRef = useRef<string | null>(null);
  const initializedRef = useRef(false);

  const handleLiveSignal = useCallback((signal: DisplayTodosLiveSignal) => {
    const { revision } = signal;
    if (!revision) return;

    if (!initializedRef.current) {
      initializedRef.current = true;
      lastRevisionRef.current = revision;
      return;
    }

    if (lastRevisionRef.current !== revision) {
      lastRevisionRef.current = revision;
      const snapshot = parseDisplayTodosLiveRevision(revision);
      if (snapshot) {
        dispatchDisplayTodoBadgeSnapshot(snapshot);
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      lastRevisionRef.current = null;
      initializedRef.current = false;
      return;
    }

    let cancelled = false;

    const tick = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/display/todos/live-signal", {
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as DisplayTodosLiveSignal;
        handleLiveSignal(body);
      } catch {
        /* Hintergrund-Polling */
      }
    };

    const onPinSync = () => {
      initializedRef.current = false;
      lastRevisionRef.current = null;
      void tick();
    };

    const onGuardedSnapshot = (event: Event) => {
      const detail = (event as CustomEvent<DisplayTodoBadgeSnapshot>).detail;
      if (!detail?.guardRefresh) return;
      lastRevisionRef.current = `${detail.badge_count}|${detail.badge_urgency}`;
      initializedRef.current = true;
    };

    void tick();
    const id = window.setInterval(() => void tick(), DISPLAY_TODOS_POLL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener(GWADA_DISPLAY_TODOS_LIVE_SYNC_EVENT, onPinSync);
    window.addEventListener(
      GWADA_DISPLAY_TODOS_BADGE_SNAPSHOT_EVENT,
      onGuardedSnapshot,
    );

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(GWADA_DISPLAY_TODOS_LIVE_SYNC_EVENT, onPinSync);
      window.removeEventListener(
        GWADA_DISPLAY_TODOS_BADGE_SNAPSHOT_EVENT,
        onGuardedSnapshot,
      );
    };
  }, [enabled, handleLiveSignal]);
}

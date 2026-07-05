"use client";

import { useCallback, useEffect, useRef } from "react";

const DEFAULT_POLL_MS = 2_000;
const DEFAULT_RECONCILE_MS = 2_500;

type LiveRevisionBody = { revision?: string };

/**
 * Display-Modul: schnelles Revision-Polling + debounced Refresh-Callback.
 */
export function useDisplayModuleLivePoll(
  enabled: boolean,
  liveSignalPath: string,
  onRefresh: () => void,
  options?: { pollMs?: number; reconcileMs?: number },
) {
  const lastRevisionRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const reconcileRef = useRef<number | null>(null);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const pollMs = options?.pollMs ?? DEFAULT_POLL_MS;
  const reconcileMs = options?.reconcileMs ?? DEFAULT_RECONCILE_MS;

  const scheduleRefresh = useCallback(() => {
    if (reconcileRef.current) {
      window.clearTimeout(reconcileRef.current);
    }
    reconcileRef.current = window.setTimeout(() => {
      reconcileRef.current = null;
      onRefreshRef.current();
    }, reconcileMs);
  }, [reconcileMs]);

  const handleRevision = useCallback(
    (revision: string) => {
      if (!initializedRef.current) {
        initializedRef.current = true;
        lastRevisionRef.current = revision;
        return;
      }
      if (lastRevisionRef.current === revision) return;
      lastRevisionRef.current = revision;
      scheduleRefresh();
    },
    [scheduleRefresh],
  );

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
        const res = await fetch(liveSignalPath, {
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as LiveRevisionBody;
        handleRevision(body.revision ?? "");
      } catch {
        /* Hintergrund-Polling */
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), pollMs);

    const onVisibility = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      if (reconcileRef.current) {
        window.clearTimeout(reconcileRef.current);
        reconcileRef.current = null;
      }
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, handleRevision, liveSignalPath, pollMs]);
}

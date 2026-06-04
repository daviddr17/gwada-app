"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Intervall-Polling nur bei sichtbarem Tab.
 */
export function useVisibleIntervalPolling(intervalMs: number) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<(() => void) | null>(null);
  const activeRef = useRef(false);

  const stop = useCallback(() => {
    activeRef.current = false;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(
    (tick: () => void) => {
      tickRef.current = tick;
      if (activeRef.current) return;
      activeRef.current = true;
      if (document.visibilityState === "visible") {
        void tick();
        timerRef.current = setInterval(() => {
          if (document.visibilityState === "visible") void tickRef.current?.();
        }, intervalMs);
      }
    },
    [intervalMs],
  );

  useEffect(() => {
    const onVisibility = () => {
      if (!activeRef.current || !tickRef.current) return;
      if (document.visibilityState === "visible") {
        void tickRef.current();
        if (!timerRef.current) {
          timerRef.current = setInterval(() => {
            if (document.visibilityState === "visible") void tickRef.current?.();
          }, intervalMs);
        }
      } else if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [intervalMs, stop]);

  return { start, stop };
}

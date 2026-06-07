"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import {
  RouteSweepOverlay,
  sweepDurationMs,
} from "@/components/layout/route-sweep-overlay";
import { AUTH_ENTER_APP_META } from "@/lib/navigation/auth-enter-transition";

/** Sweep vor Weiterleitung ins App (Login → Dashboard). */
export function useAuthEnterTransition() {
  const reducedMotion = useReducedMotion() ?? false;
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;

  const [overlayMeta, setOverlayMeta] = useState<typeof AUTH_ENTER_APP_META | null>(
    null,
  );
  const clearTimerRef = useRef<number | null>(null);

  const enterApp = useCallback((redirect: () => void) => {
    if (clearTimerRef.current != null) {
      window.clearTimeout(clearTimerRef.current);
    }

    setOverlayMeta(AUTH_ENTER_APP_META);
    const totalMs = sweepDurationMs("marketing", reducedMotionRef.current);
    clearTimerRef.current = window.setTimeout(() => {
      redirect();
      clearTimerRef.current = null;
    }, totalMs);
  }, []);

  useEffect(() => {
    if (!overlayMeta) return;
    const failsafe = window.setTimeout(() => setOverlayMeta(null), 2500);
    return () => window.clearTimeout(failsafe);
  }, [overlayMeta]);

  useEffect(
    () => () => {
      if (clearTimerRef.current != null) {
        window.clearTimeout(clearTimerRef.current);
      }
    },
    [],
  );

  const overlay = (
    <RouteSweepOverlay meta={overlayMeta} variant="marketing" className="z-[130]" />
  );

  return { enterApp, overlay, isEntering: overlayMeta != null };
}

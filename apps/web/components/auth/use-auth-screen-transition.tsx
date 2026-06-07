"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { LogIn, UserPlus } from "lucide-react";
import {
  RouteSweepOverlay,
  type RouteSweepMeta,
  sweepDurationMs,
} from "@/components/layout/route-sweep-overlay";

export type AuthScreenId = "login" | "register";

const AUTH_SCREEN_META: Record<AuthScreenId, RouteSweepMeta> = {
  login: {
    id: "auth-login",
    label: "Anmelden",
    subtitle: "Willkommen zurück",
    Icon: LogIn,
    iconClassName: "bg-accent/15 text-accent-foreground",
  },
  register: {
    id: "auth-register",
    label: "Registrieren",
    subtitle: "Neues Konto anlegen",
    Icon: UserPlus,
    iconClassName: "bg-primary/10 text-primary",
  },
};

export function useAuthScreenTransition(initial: AuthScreenId = "login") {
  const reducedMotion = useReducedMotion() ?? false;
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;

  const [screen, setScreen] = useState<AuthScreenId>(initial);
  const [overlayMeta, setOverlayMeta] = useState<RouteSweepMeta | null>(null);
  const swapTimerRef = useRef<number | null>(null);
  const clearTimerRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (swapTimerRef.current != null) {
      window.clearTimeout(swapTimerRef.current);
      swapTimerRef.current = null;
    }
    if (clearTimerRef.current != null) {
      window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
  }, []);

  const transitionTo = useCallback(
    (next: AuthScreenId) => {
      if (next === screen || overlayMeta) return;

      clearTimers();

      const totalMs = sweepDurationMs("auth", reducedMotionRef.current);
      const swapMs = Math.round(totalMs * 0.44);

      setOverlayMeta(AUTH_SCREEN_META[next]);

      swapTimerRef.current = window.setTimeout(() => {
        setScreen(next);
        swapTimerRef.current = null;
      }, swapMs);

      clearTimerRef.current = window.setTimeout(() => {
        setOverlayMeta(null);
        clearTimerRef.current = null;
      }, totalMs);
    },
    [screen, overlayMeta, clearTimers],
  );

  useEffect(() => {
    if (!overlayMeta) return;
    const failsafe = window.setTimeout(() => {
      setOverlayMeta(null);
      clearTimers();
    }, 2500);
    return () => window.clearTimeout(failsafe);
  }, [overlayMeta, clearTimers]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const overlay = (
    <RouteSweepOverlay meta={overlayMeta} variant="auth" className="z-[120]" />
  );

  return { screen, transitionTo, overlay, isTransitioning: overlayMeta != null };
}

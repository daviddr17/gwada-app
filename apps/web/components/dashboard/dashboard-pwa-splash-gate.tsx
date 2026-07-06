"use client";

import { useReducedMotion } from "framer-motion";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { PwaSplashPhase } from "@/components/pwa/pwa-splash-screen";
import { PwaSplashScreen } from "@/components/pwa/pwa-splash-screen";
import { dashboardPwaIconPath } from "@/lib/dashboard/dashboard-pwa-config";
import { useWorkspaceAuthSession } from "@/lib/contexts/workspace-auth-session-context";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import {
  clearDashboardPwaSplashDone,
  isStandalonePwaClient,
  markDashboardPwaSplashDone,
} from "@/lib/pwa/is-standalone-pwa-client";
import {
  PWA_SPLASH_EXIT_MS,
  PWA_SPLASH_HOLD_MS,
  PWA_SPLASH_MAX_MS,
  PWA_SPLASH_MIN_SPIN_MS,
} from "@/lib/pwa/pwa-splash-timing";

const SPLASH_ICON_SRC = dashboardPwaIconPath(192);

type DashboardPwaSplashGateProps = {
  children: ReactNode;
};

/**
 * PWA-Start: statisches Logo (OS-Übergang) → Drehen während Session/Workspace lädt → Ausblenden.
 * Nur im Standalone-Modus; Browser-Tab ohne Splash.
 */
export function DashboardPwaSplashGate({ children }: DashboardPwaSplashGateProps) {
  const reduceMotion = useReducedMotion();
  const { ready: authReady } = useWorkspaceAuthSession();
  const { ready: workspaceReady } = useWorkspaceRestaurantUuid();

  const [enabled, setEnabled] = useState(false);
  const [phase, setPhase] = useState<PwaSplashPhase>("hold");
  const spinStartedAtRef = useRef<number | null>(null);
  const exitTimerRef = useRef<number | null>(null);
  const maxTimerRef = useRef<number | null>(null);
  const finishedRef = useRef(false);

  const finishSplash = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    markDashboardPwaSplashDone();
    setPhase("done");
  }, []);

  useLayoutEffect(() => {
    const standalone = isStandalonePwaClient();
    if (!standalone || reduceMotion) {
      markDashboardPwaSplashDone();
      setEnabled(false);
      setPhase("done");
      return;
    }

    clearDashboardPwaSplashDone();
    setEnabled(true);
    setPhase("hold");
  }, [reduceMotion]);

  useEffect(() => {
    if (!enabled || phase === "done" || phase === "exit") return;

    if (phase === "hold") {
      const holdTimer = window.setTimeout(() => {
        spinStartedAtRef.current = performance.now();
        setPhase("spin");
      }, PWA_SPLASH_HOLD_MS);

      return () => window.clearTimeout(holdTimer);
    }

    return undefined;
  }, [enabled, phase]);

  useEffect(() => {
    if (!enabled || phase !== "spin") return;
    if (!authReady || !workspaceReady) return;

    const spinStartedAt = spinStartedAtRef.current ?? performance.now();
    const spinElapsed = performance.now() - spinStartedAt;
    const minSpinRemaining = Math.max(0, PWA_SPLASH_MIN_SPIN_MS - spinElapsed);

    const startExitTimer = window.setTimeout(() => {
      setPhase("exit");
      exitTimerRef.current = window.setTimeout(() => {
        finishSplash();
      }, PWA_SPLASH_EXIT_MS);
    }, minSpinRemaining);

    return () => {
      window.clearTimeout(startExitTimer);
      if (exitTimerRef.current != null) {
        window.clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
    };
  }, [authReady, enabled, finishSplash, phase, workspaceReady]);

  useEffect(() => {
    if (!enabled || phase === "done") return;

    maxTimerRef.current = window.setTimeout(() => {
      if (phase !== "exit") {
        setPhase("exit");
        exitTimerRef.current = window.setTimeout(() => {
          finishSplash();
        }, PWA_SPLASH_EXIT_MS);
      }
    }, PWA_SPLASH_MAX_MS);

    return () => {
      if (maxTimerRef.current != null) {
        window.clearTimeout(maxTimerRef.current);
      }
    };
  }, [enabled, finishSplash, phase]);

  const splashPhase: PwaSplashPhase = enabled ? phase : "hold";

  return (
    <>
      {phase !== "done" ? (
        <PwaSplashScreen iconSrc={SPLASH_ICON_SRC} phase={splashPhase} />
      ) : null}
      {children}
    </>
  );
}

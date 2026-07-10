"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useReducedMotion } from "framer-motion";
import {
  RouteSweepOverlay,
  sweepDurationMs,
} from "@/components/layout/route-sweep-overlay";
import { AUTH_LOGOUT_META } from "@/lib/navigation/auth-logout-transition";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type AuthLogoutTransitionValue = {
  logout: () => void;
  isLoggingOut: boolean;
};

const AuthLogoutTransitionContext =
  createContext<AuthLogoutTransitionValue | null>(null);

/** Sweep-Overlay vor signOut — Dashboard-Inhalt bleibt darunter, bis Redirect. */
export function AuthLogoutTransitionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const reducedMotion = useReducedMotion() ?? false;
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;

  const [overlayMeta, setOverlayMeta] = useState<typeof AUTH_LOGOUT_META | null>(
    null,
  );
  const clearTimerRef = useRef<number | null>(null);
  const startedRef = useRef(false);

  const logout = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (clearTimerRef.current != null) {
      window.clearTimeout(clearTimerRef.current);
    }

    setOverlayMeta(AUTH_LOGOUT_META);
    const totalMs = sweepDurationMs("auth", reducedMotionRef.current);
    clearTimerRef.current = window.setTimeout(() => {
      void (async () => {
        try {
          const sb = createSupabaseBrowserClient();
          await sb.auth.signOut();
        } finally {
          window.location.assign("/login");
        }
      })();
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

  const value: AuthLogoutTransitionValue = {
    logout,
    isLoggingOut: overlayMeta != null,
  };

  return (
    <AuthLogoutTransitionContext.Provider value={value}>
      {children}
      <RouteSweepOverlay
        meta={overlayMeta}
        variant="auth"
        className="z-[220] pointer-events-auto"
      />
    </AuthLogoutTransitionContext.Provider>
  );
}

export function useAuthLogoutTransition(): AuthLogoutTransitionValue {
  const ctx = useContext(AuthLogoutTransitionContext);
  if (!ctx) {
    throw new Error(
      "useAuthLogoutTransition erfordert AuthLogoutTransitionProvider.",
    );
  }
  return ctx;
}

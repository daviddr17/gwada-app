"use client";

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

type SoftNavLockValue = {
  tryAcquireNavLock: (
    event: { preventDefault: () => void },
    targetHref: string,
  ) => boolean;
  /** Ziel-Route während Soft-Nav — Sidebar + Pending-Overlay. */
  pendingHref: string | null;
};

const SoftNavLockContext = createContext<SoftNavLockValue | null>(null);

const PENDING_CLEAR_FAILSAFE_MS = 8_000;

export function normalizeNavHref(href: string): string {
  const path = href.split("?")[0]?.split("#")[0] ?? href;
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path || "/dashboard";
}

/**
 * Soft-Nav Pending — UI-Feedback (Sidebar + Overlay), kein Navigations-Lock.
 *
 * Pending darf nicht synchron in pointerdown/click gesetzt werden: schwere
 * Overlay-/Sidebar-Re-Renders im selben Tick haben Next-Flights abgebrochen
 * → kurzer Modulwechsel, dann Rücksprung zum vorherigen Modul.
 */
export function SoftNavLockProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const pendingTargetRef = useRef<string | null>(null);
  const scheduleTimerRef = useRef<number | null>(null);
  const clearTimerRef = useRef<number | null>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const clearPending = useCallback(() => {
    pendingTargetRef.current = null;
    setPendingHref(null);
    if (scheduleTimerRef.current != null) {
      window.clearTimeout(scheduleTimerRef.current);
      scheduleTimerRef.current = null;
    }
    if (clearTimerRef.current != null) {
      window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    clearPending();
  }, [pathname, clearPending]);

  const tryAcquireNavLock = useCallback(
    (_event: { preventDefault: () => void }, targetHref: string) => {
      const target = normalizeNavHref(targetHref);
      if (pendingTargetRef.current === target) return true;

      pendingTargetRef.current = target;
      if (scheduleTimerRef.current != null) {
        window.clearTimeout(scheduleTimerRef.current);
      }
      if (clearTimerRef.current != null) {
        window.clearTimeout(clearTimerRef.current);
        clearTimerRef.current = null;
      }

      // Nach dem Tick: Flight darf starten, bevor Overlay/Sidebar re-rendern.
      scheduleTimerRef.current = window.setTimeout(() => {
        scheduleTimerRef.current = null;
        if (pendingTargetRef.current !== target) return;
        startTransition(() => {
          setPendingHref(target);
        });
        clearTimerRef.current = window.setTimeout(
          clearPending,
          PENDING_CLEAR_FAILSAFE_MS,
        );
      }, 0);
      return true;
    },
    [clearPending],
  );

  useEffect(
    () => () => {
      if (scheduleTimerRef.current != null) {
        window.clearTimeout(scheduleTimerRef.current);
      }
      if (clearTimerRef.current != null) {
        window.clearTimeout(clearTimerRef.current);
      }
    },
    [],
  );

  return (
    <SoftNavLockContext.Provider value={{ tryAcquireNavLock, pendingHref }}>
      {children}
    </SoftNavLockContext.Provider>
  );
}

export function useSoftNavLock(): SoftNavLockValue {
  const ctx = useContext(SoftNavLockContext);
  if (!ctx) {
    throw new Error("useSoftNavLock requires SoftNavLockProvider");
  }
  return ctx;
}

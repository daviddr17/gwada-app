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
 * Soft-Nav Pending — sofortiges UI-Feedback (Sidebar + Overlay).
 * Kein preventDefault / kein harter Lock (hat Next-Flights gekillt).
 *
 * Provider-State: nur Consumer (Sidebar/Overlay) re-rendern; {children}
 * bleibt referenzstabil und unmountet nicht.
 */
export function SoftNavLockProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const pendingTargetRef = useRef<string | null>(null);
  const clearTimerRef = useRef<number | null>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const clearPending = useCallback(() => {
    pendingTargetRef.current = null;
    setPendingHref(null);
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
      pendingTargetRef.current = target;
      // Synchron im Klick — Overlay im selben Frame, Flight läuft weiter
      // (kein Unmount des Router-Outlets, kein preventDefault).
      setPendingHref(target);
      if (clearTimerRef.current != null) {
        window.clearTimeout(clearTimerRef.current);
      }
      clearTimerRef.current = window.setTimeout(
        clearPending,
        PENDING_CLEAR_FAILSAFE_MS,
      );
      return true;
    },
    [clearPending],
  );

  useEffect(
    () => () => {
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

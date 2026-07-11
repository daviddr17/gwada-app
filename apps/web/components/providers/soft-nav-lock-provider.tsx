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
  /** Ziel-Route während RSC-Flight — sofortiges Sidebar-Feedback. */
  pendingHref: string | null;
};

const SoftNavLockContext = createContext<SoftNavLockValue | null>(null);

const NAV_LOCK_FAILSAFE_MS = 12_000;

export function normalizeNavHref(href: string): string {
  const path = href.split("?")[0]?.split("#")[0] ?? href;
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path || "/dashboard";
}

/** Blockiert Doppel-Klicks auf dasselbe Modul; neues Ziel darf vorherigen Flight ersetzen. */
export function SoftNavLockProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const lockedRef = useRef(false);
  const lockedTargetRef = useRef<string | null>(null);
  const lockTimerRef = useRef<number | null>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const releaseLock = useCallback(() => {
    lockedRef.current = false;
    lockedTargetRef.current = null;
    setPendingHref(null);
    if (lockTimerRef.current != null) {
      window.clearTimeout(lockTimerRef.current);
      lockTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    releaseLock();
  }, [pathname, releaseLock]);

  const tryAcquireNavLock = useCallback(
    (event: { preventDefault: () => void }, targetHref: string) => {
      const target = normalizeNavHref(targetHref);
      if (lockedRef.current) {
        if (lockedTargetRef.current === target) {
          event.preventDefault();
          return false;
        }
        releaseLock();
      }
      lockedRef.current = true;
      lockedTargetRef.current = target;
      setPendingHref(target);
      lockTimerRef.current = window.setTimeout(releaseLock, NAV_LOCK_FAILSAFE_MS);
      return true;
    },
    [releaseLock],
  );

  useEffect(
    () => () => {
      if (lockTimerRef.current != null) {
        window.clearTimeout(lockTimerRef.current);
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

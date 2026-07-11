"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

type SoftNavLockValue = {
  tryAcquireNavLock: (event: { preventDefault: () => void }) => boolean;
};

const SoftNavLockContext = createContext<SoftNavLockValue | null>(null);

const NAV_LOCK_FAILSAFE_MS = 6_000;

/** Blockiert parallele Modul-Klicks, bis pathname gewechselt hat (RSC-Flight fertig). */
export function SoftNavLockProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const lockedRef = useRef(false);
  const lockTimerRef = useRef<number | null>(null);

  useEffect(() => {
    lockedRef.current = false;
    if (lockTimerRef.current != null) {
      window.clearTimeout(lockTimerRef.current);
      lockTimerRef.current = null;
    }
  }, [pathname]);

  const tryAcquireNavLock = useCallback(
    (event: { preventDefault: () => void }) => {
      if (lockedRef.current) {
        event.preventDefault();
        return false;
      }
      lockedRef.current = true;
      if (lockTimerRef.current != null) {
        window.clearTimeout(lockTimerRef.current);
      }
      lockTimerRef.current = window.setTimeout(() => {
        lockedRef.current = false;
        lockTimerRef.current = null;
      }, NAV_LOCK_FAILSAFE_MS);
      return true;
    },
    [],
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
    <SoftNavLockContext.Provider value={{ tryAcquireNavLock }}>
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

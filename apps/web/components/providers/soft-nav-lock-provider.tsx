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

/** Blockiert parallele Modul-Klicks, bis pathname gewechselt hat (RSC-Flight fertig). */
export function SoftNavLockProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const lockedRef = useRef(false);

  useEffect(() => {
    lockedRef.current = false;
  }, [pathname]);

  const tryAcquireNavLock = useCallback(
    (event: { preventDefault: () => void }) => {
      if (lockedRef.current) {
        event.preventDefault();
        return false;
      }
      lockedRef.current = true;
      return true;
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

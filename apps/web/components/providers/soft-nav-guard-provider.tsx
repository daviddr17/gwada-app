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

type SoftNavGuardValue = {
  /** true = Klick blockiert (paralleler Modulwechsel läuft). */
  onCrossModuleClick: (event: { preventDefault: () => void }) => boolean;
};

const SoftNavGuardContext = createContext<SoftNavGuardValue | null>(null);

export function SoftNavGuardProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const inFlightRef = useRef(false);
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inFlightRef.current = false;
    if (releaseTimerRef.current) {
      clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = null;
    }
  }, [pathname]);

  const onCrossModuleClick = useCallback(
    (event: { preventDefault: () => void }) => {
      if (inFlightRef.current) {
        event.preventDefault();
        return true;
      }
      inFlightRef.current = true;
      if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = setTimeout(() => {
        inFlightRef.current = false;
        releaseTimerRef.current = null;
      }, 10_000);
      return false;
    },
    [],
  );

  return (
    <SoftNavGuardContext.Provider value={{ onCrossModuleClick }}>
      {children}
    </SoftNavGuardContext.Provider>
  );
}

export function useSoftNavGuard(): SoftNavGuardValue {
  const ctx = useContext(SoftNavGuardContext);
  if (!ctx) {
    throw new Error("useSoftNavGuard requires SoftNavGuardProvider");
  }
  return ctx;
}

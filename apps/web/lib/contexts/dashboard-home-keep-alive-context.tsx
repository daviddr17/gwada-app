"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import {
  normalizeNavHref,
  useSoftNavLock,
} from "@/components/providers/soft-nav-lock-provider";
import { isDashboardHomePath } from "@/lib/navigation/dashboard-home-path";

export type DashboardHomeKeepAliveValue = {
  /** Mindestens einmal gemountet — Soft-Nav kann Skeleton überspringen. */
  warm: boolean;
  /** UI sichtbar (inkl. optimistisch während Soft-Nav zurück nach /dashboard). */
  visible: boolean;
  /** Arbeit erlaubt: Background-Refresh, Chrome, FAB — nur auf echter Home-URL. */
  active: boolean;
};

const DashboardHomeKeepAliveContext =
  createContext<DashboardHomeKeepAliveValue | null>(null);

export function DashboardHomeKeepAliveProvider({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { pendingHref } = useSoftNavLock();
  const onHome = isDashboardHomePath(pathname);
  const [warm, setWarm] = useState(onHome);

  useLayoutEffect(() => {
    if (onHome) setWarm(true);
  }, [onHome]);

  const pendingToHome =
    warm &&
    pendingHref != null &&
    normalizeNavHref(pendingHref) === "/dashboard" &&
    !onHome;

  const value = useMemo<DashboardHomeKeepAliveValue>(
    () => ({
      warm: warm || onHome,
      visible: onHome || pendingToHome,
      active: onHome,
    }),
    [warm, onHome, pendingToHome],
  );

  return (
    <DashboardHomeKeepAliveContext.Provider value={value}>
      {children}
    </DashboardHomeKeepAliveContext.Provider>
  );
}

export function useDashboardHomeKeepAlive(): DashboardHomeKeepAliveValue {
  const ctx = useContext(DashboardHomeKeepAliveContext);
  if (!ctx) {
    throw new Error(
      "useDashboardHomeKeepAlive requires DashboardHomeKeepAliveProvider",
    );
  }
  return ctx;
}

export function useDashboardHomeKeepAliveOptional(): DashboardHomeKeepAliveValue | null {
  return useContext(DashboardHomeKeepAliveContext);
}

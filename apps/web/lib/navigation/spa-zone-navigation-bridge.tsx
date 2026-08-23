"use client";

import {
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import {
  tanstackLocationToZonePath,
  zoneHrefToTanstackTarget,
  type SpaZoneBase,
} from "@/lib/navigation/spa-zone-path";

type SpaZoneNavigationValue = {
  base: SpaZoneBase;
  pathname: string;
  searchStr: string;
  params: Record<string, string>;
  navigate: ReturnType<typeof useNavigate>;
  hrefToTarget: (href: string) => ReturnType<typeof zoneHrefToTanstackTarget>;
};

const SpaZoneNavigationContext =
  createContext<SpaZoneNavigationValue | null>(null);

/** TanStack Router → gemeinsame Pfad-API für next/navigation-Shim. */
export function SpaZoneNavigationBridge({
  base,
  children,
}: {
  base: SpaZoneBase;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const snapshot = useRouterState({
    select: (s) => ({
      pathname: s.location.pathname,
      searchStr: s.location.searchStr ?? "",
      params: s.matches[s.matches.length - 1]?.params ?? {},
    }),
  });
  const pathname = tanstackLocationToZonePath(base, snapshot.pathname);

  const value = useMemo(
    () => ({
      base,
      pathname,
      searchStr: snapshot.searchStr,
      params: snapshot.params as Record<string, string>,
      navigate,
      hrefToTarget: (href: string) => zoneHrefToTanstackTarget(base, href),
    }),
    [base, pathname, snapshot.searchStr, snapshot.params, navigate],
  );

  return (
    <SpaZoneNavigationContext.Provider value={value}>
      {children}
    </SpaZoneNavigationContext.Provider>
  );
}

export function useSpaZoneNavigationOptional(): SpaZoneNavigationValue | null {
  return useContext(SpaZoneNavigationContext);
}

/** @deprecated use useSpaZoneNavigationOptional */
export function useDashboardSpaNavigationOptional(): SpaZoneNavigationValue | null {
  return useSpaZoneNavigationOptional();
}

/** @deprecated use SpaZoneNavigationBridge */
export function DashboardSpaNavigationBridge({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <SpaZoneNavigationBridge base="/dashboard">{children}</SpaZoneNavigationBridge>
  );
}

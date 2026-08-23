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
  dashboardHrefToTanstackTarget,
  tanstackLocationToDashboardPath,
} from "@/lib/navigation/dashboard-spa-path";

type DashboardSpaNavigationValue = {
  pathname: string;
  searchStr: string;
  params: Record<string, string>;
  navigate: ReturnType<typeof useNavigate>;
};

const DashboardSpaNavigationContext =
  createContext<DashboardSpaNavigationValue | null>(null);

/** TanStack Router → gemeinsame Pfad-API für next/navigation-Shim. */
export function DashboardSpaNavigationBridge({
  children,
}: {
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
  const pathname = tanstackLocationToDashboardPath(snapshot.pathname);

  const value = useMemo(
    () => ({
      pathname,
      searchStr: snapshot.searchStr,
      params: snapshot.params as Record<string, string>,
      navigate,
    }),
    [pathname, snapshot.searchStr, snapshot.params, navigate],
  );

  return (
    <DashboardSpaNavigationContext.Provider value={value}>
      {children}
    </DashboardSpaNavigationContext.Provider>
  );
}

export function useDashboardSpaNavigationOptional():
  DashboardSpaNavigationValue | null {
  return useContext(DashboardSpaNavigationContext);
}

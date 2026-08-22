"use client";

import {
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  SoftNavLockContext,
  normalizeNavHref,
  type SoftNavLockValue,
} from "@/lib/navigation/soft-nav-lock-context";

function splitHref(href: string): {
  pathname: string;
  search: Record<string, string>;
} {
  const [pathPart, searchPart] = href.split("?");
  const pathname = normalizeNavHref(pathPart ?? href);
  const search: Record<string, string> = {};
  if (searchPart) {
    for (const pair of searchPart.split("&")) {
      const [k, v] = pair.split("=");
      if (k) search[k] = decodeURIComponent(v ?? "");
    }
  }
  return { pathname, search };
}

/** TanStack Router — gleicher Context wie Next SoftNavLockProvider. */
export function SoftNavLockProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const routerState = useRouterState();
  const pendingHref = routerState.isLoading
    ? routerState.location.pathname
    : null;

  const scheduleSoftNavPush = useCallback(
    (href: string) => {
      const { pathname, search } = splitHref(href);
      const to =
        pathname === "/dashboard"
          ? "/"
          : pathname.replace(/^\/dashboard/, "") || "/";
      navigate({ to, search });
    },
    [navigate],
  );

  const tryAcquireNavLock = useCallback(
    (
      _event: { preventDefault: () => void },
      _targetHref: string,
    ) => true,
    [],
  );

  const value = useMemo(
    () => ({
      tryAcquireNavLock,
      pendingHref,
      scheduleSoftNavPush,
    }),
    [tryAcquireNavLock, pendingHref, scheduleSoftNavPush],
  );

  return (
    <SoftNavLockContext.Provider value={value}>
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

export { normalizeNavHref };

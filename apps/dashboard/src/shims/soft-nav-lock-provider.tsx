"use client";

import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  SoftNavLockContext,
  normalizeNavHref,
  type SoftNavLockValue,
} from "@/lib/navigation/soft-nav-lock-context";
import {
  dashboardHrefToTanstackTarget,
  tanstackLocationToDashboardPath,
} from "@/lib/navigation/dashboard-spa-path";
import { isSoftNavPendingArrived } from "@/lib/navigation/module-home-keep-alive";
import {
  beginSoftNavFlight,
  endSoftNavFlight,
} from "@/lib/navigation/soft-nav-flight";
import { prefetchDashboardSpaHref } from "../navigation/prefetch-dashboard-route";

const PENDING_CLEAR_FAILSAFE_MS = 4_500;
const PENDING_HARD_CLEAR_MS = 8_000;

/** TanStack Router — gleicher Context wie Next SoftNavLockProvider. */
export function SoftNavLockProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useRouterState({ select: (s) => s.location });
  const pathname = tanstackLocationToDashboardPath(location.pathname);
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const pendingTargetRef = useRef<string | null>(null);
  const clearTimerRef = useRef<number | null>(null);
  const hardClearTimerRef = useRef<number | null>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const clearPending = useCallback(() => {
    pendingTargetRef.current = null;
    endSoftNavFlight();
    setPendingHref(null);
    if (clearTimerRef.current != null) {
      window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
    if (hardClearTimerRef.current != null) {
      window.clearTimeout(hardClearTimerRef.current);
      hardClearTimerRef.current = null;
    }
  }, []);

  useLayoutEffect(() => {
    const target = pendingTargetRef.current;
    if (target == null) return;
    if (!isSoftNavPendingArrived(pathname, target)) return;
    clearPending();
  }, [pathname, clearPending]);

  const scheduleSoftNavPush = useCallback(
    (href: string) => {
      prefetchDashboardSpaHref(href);
      const { to, search } = dashboardHrefToTanstackTarget(href);
      navigate({ to, search });
    },
    [navigate],
  );

  const tryAcquireNavLock = useCallback(
    (_event: { preventDefault: () => void }, targetHref: string) => {
      const target = normalizeNavHref(targetHref);
      if (
        pendingTargetRef.current === target &&
        isSoftNavPendingArrived(pathnameRef.current, target)
      ) {
        return false;
      }

      prefetchDashboardSpaHref(targetHref);
      pendingTargetRef.current = target;
      beginSoftNavFlight(targetHref);
      setPendingHref(target);

      if (clearTimerRef.current != null) {
        window.clearTimeout(clearTimerRef.current);
      }
      clearTimerRef.current = window.setTimeout(() => {
        clearTimerRef.current = null;
        clearPending();
      }, PENDING_CLEAR_FAILSAFE_MS);

      if (hardClearTimerRef.current != null) {
        window.clearTimeout(hardClearTimerRef.current);
      }
      hardClearTimerRef.current = window.setTimeout(() => {
        hardClearTimerRef.current = null;
        clearPending();
      }, PENDING_HARD_CLEAR_MS);

      return true;
    },
    [clearPending],
  );

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) clearPending();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [clearPending]);

  useEffect(
    () => () => {
      if (clearTimerRef.current != null) {
        window.clearTimeout(clearTimerRef.current);
      }
      if (hardClearTimerRef.current != null) {
        window.clearTimeout(hardClearTimerRef.current);
      }
      endSoftNavFlight();
    },
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

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
import { usePathname, useRouter } from "next/navigation";
import {
  coalesceSoftNavPush,
  flushSoftNavPush,
} from "@/lib/navigation/soft-nav-coalesced-push";
import {
  beginSoftNavFlight,
  endSoftNavFlight,
} from "@/lib/navigation/soft-nav-flight";
import { isSoftNavPendingArrived } from "@/lib/navigation/module-home-keep-alive";

type SoftNavLockValue = {
  tryAcquireNavLock: (
    event: { preventDefault: () => void },
    targetHref: string,
  ) => boolean;
  /** Ziel-Route während Soft-Nav — Sidebar + Overlay. */
  pendingHref: string | null;
  /** Coalesced router.push — letzter Klick gewinnt. */
  scheduleSoftNavPush: (href: string) => void;
};

const SoftNavLockContext = createContext<SoftNavLockValue | null>(null);

const PENDING_CLEAR_FAILSAFE_MS = 6_000;
const PENDING_RETRY_EXTRA_MS = 3_500;

export function normalizeNavHref(href: string): string {
  const path = href.split("?")[0]?.split("#")[0] ?? href;
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path || "/dashboard";
}

/**
 * Soft-Nav Pending — sofortiges UI-Feedback (Sidebar + Overlay).
 * Trailing-coalesced `router.push` (letzter Klick gewinnt). Ein Failsafe-Retry,
 * kein Recovery-/Repush-Loop — der hat Live-Nav unter Stress kaputt gemacht.
 */
export function SoftNavLockProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const pendingTargetRef = useRef<string | null>(null);
  const pendingRawHrefRef = useRef<string | null>(null);
  const clearTimerRef = useRef<number | null>(null);
  const paintClearRafRef = useRef<number | null>(null);
  const failsafeRetriedRef = useRef(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const clearPending = useCallback(() => {
    pendingTargetRef.current = null;
    pendingRawHrefRef.current = null;
    failsafeRetriedRef.current = false;
    endSoftNavFlight();
    setPendingHref(null);
    if (clearTimerRef.current != null) {
      window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
    if (paintClearRafRef.current != null) {
      window.cancelAnimationFrame(paintClearRafRef.current);
      paintClearRafRef.current = null;
    }
  }, []);

  const armFailsafe = useCallback(
    (ms: number) => {
      if (clearTimerRef.current != null) {
        window.clearTimeout(clearTimerRef.current);
      }
      clearTimerRef.current = window.setTimeout(() => {
        clearTimerRef.current = null;
        const raw = pendingRawHrefRef.current;
        const target = pendingTargetRef.current;
        const atTarget =
          target != null &&
          isSoftNavPendingArrived(pathnameRef.current, target);
        if (raw && target && !atTarget && !failsafeRetriedRef.current) {
          failsafeRetriedRef.current = true;
          flushSoftNavPush(router);
          router.push(raw);
          armFailsafe(PENDING_RETRY_EXTRA_MS);
          return;
        }
        clearPending();
      }, ms);
    },
    [clearPending, router],
  );

  // Ziel erreicht → Cover erst nach Paint heben (kein Weiß/Dashboard-Flash).
  useEffect(() => {
    const target = pendingTargetRef.current;
    if (target == null) return;
    if (!isSoftNavPendingArrived(pathname, target)) return;

    let raf2: number | null = null;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        paintClearRafRef.current = null;
        if (
          pendingTargetRef.current === target &&
          isSoftNavPendingArrived(pathnameRef.current, target)
        ) {
          clearPending();
        }
      });
      paintClearRafRef.current = raf2;
    });
    paintClearRafRef.current = raf1;

    return () => {
      window.cancelAnimationFrame(raf1);
      if (raf2 != null) window.cancelAnimationFrame(raf2);
      if (
        paintClearRafRef.current === raf1 ||
        paintClearRafRef.current === raf2
      ) {
        paintClearRafRef.current = null;
      }
    };
  }, [pathname, clearPending]);

  const scheduleSoftNavPush = useCallback(
    (href: string) => {
      pendingRawHrefRef.current = href;
      coalesceSoftNavPush(router, href);
    },
    [router],
  );

  const tryAcquireNavLock = useCallback(
    (_event: { preventDefault: () => void }, targetHref: string) => {
      const target = normalizeNavHref(targetHref);
      // Bereits am Ziel — kein zweites push.
      if (
        pendingTargetRef.current === target &&
        isSoftNavPendingArrived(pathnameRef.current, target)
      ) {
        return false;
      }

      pendingTargetRef.current = target;
      pendingRawHrefRef.current = targetHref;
      failsafeRetriedRef.current = false;
      beginSoftNavFlight(targetHref);
      if (paintClearRafRef.current != null) {
        window.cancelAnimationFrame(paintClearRafRef.current);
        paintClearRafRef.current = null;
      }

      setPendingHref(target);
      armFailsafe(PENDING_CLEAR_FAILSAFE_MS);
      return true;
    },
    [armFailsafe],
  );

  useEffect(
    () => () => {
      if (clearTimerRef.current != null) {
        window.clearTimeout(clearTimerRef.current);
      }
      if (paintClearRafRef.current != null) {
        window.cancelAnimationFrame(paintClearRafRef.current);
      }
    },
    [],
  );

  return (
    <SoftNavLockContext.Provider
      value={{
        tryAcquireNavLock,
        pendingHref,
        scheduleSoftNavPush,
      }}
    >
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

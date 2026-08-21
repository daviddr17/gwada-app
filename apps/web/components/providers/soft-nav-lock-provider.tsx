"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
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
import {
  isSoftNavPendingArrived,
  shouldAbandonSoftNavPending,
  shouldRepushSoftNav,
} from "@/lib/navigation/module-home-keep-alive";

type SoftNavLockValue = {
  tryAcquireNavLock: (
    event: { preventDefault: () => void },
    targetHref: string,
  ) => boolean;
  /** Ziel-Route während Soft-Nav — Sidebar + Overlay. */
  pendingHref: string | null;
  /**
   * Quell-Home nach dem Wechsel noch kurz unterdrücken — sonst blitzt
   * Dashboard auf, wenn ein späterer RSC die URL zurückzieht.
   */
  sourceGuardHref: string | null;
  /** Coalesced router.push — letzter Klick gewinnt. */
  scheduleSoftNavPush: (href: string) => void;
};

const SoftNavLockContext = createContext<SoftNavLockValue | null>(null);

/** Ziel muss so lange stehen bleiben — sonst räumt ein späterer Dashboard-RSC die URL wieder. */
const PENDING_ARRIVED_STABLE_MS = 400;
/** Erster Retry, wenn der Click-Push vom laufenden Stream geschluckt wurde. */
const PENDING_SOURCE_RETRY_MS = 180;
const PENDING_REPUSH_GAP_MS = 150;
const PENDING_MAX_REPUSH = 40;
/** Nach erfolgreicher Ankunft: späten RSC-Revert (Dashboard-Batch ~6s) noch abfangen. */
const PENDING_RECOVERY_MS = 8_000;
/** Aufgeben, wenn das Ziel nie ankommt. */
const PENDING_GIVE_UP_MS = 8_000;

type SoftNavRecovery = {
  from: string;
  to: string;
  raw: string;
  until: number;
};

export function normalizeNavHref(href: string): string {
  const path = href.split("?")[0]?.split("#")[0] ?? href;
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path || "/dashboard";
}

/**
 * Soft-Nav Pending — sofortiges UI-Feedback (Sidebar + Overlay).
 * Doppel-`router.push` auf dasselbe Ziel wird blockiert; neues Ziel ersetzt
 * das Pending (letzter Klick gewinnt). Pushes werden coalesced. Ein noch
 * laufender Dashboard-/Modul-Stream darf die URL nicht dauerhaft zurückziehen.
 */
export function SoftNavLockProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const pendingTargetRef = useRef<string | null>(null);
  const pendingFromRef = useRef<string | null>(null);
  const pendingRawHrefRef = useRef<string | null>(null);
  const giveUpTimerRef = useRef<number | null>(null);
  const arrivedStableTimerRef = useRef<number | null>(null);
  const sourceRetryTimerRef = useRef<number | null>(null);
  const recoveryRef = useRef<SoftNavRecovery | null>(null);
  const lastRepushAtRef = useRef(0);
  const repushCountRef = useRef(0);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [sourceGuardHref, setSourceGuardHref] = useState<string | null>(null);
  const guardClearTimerRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (giveUpTimerRef.current != null) {
      window.clearTimeout(giveUpTimerRef.current);
      giveUpTimerRef.current = null;
    }
    if (arrivedStableTimerRef.current != null) {
      window.clearTimeout(arrivedStableTimerRef.current);
      arrivedStableTimerRef.current = null;
    }
    if (sourceRetryTimerRef.current != null) {
      window.clearTimeout(sourceRetryTimerRef.current);
      sourceRetryTimerRef.current = null;
    }
  }, []);

  const clearSourceGuardTimer = useCallback(() => {
    if (guardClearTimerRef.current != null) {
      window.clearTimeout(guardClearTimerRef.current);
      guardClearTimerRef.current = null;
    }
  }, []);

  const holdSourceGuard = useCallback(
    (from: string | null, persistMs?: number) => {
      setSourceGuardHref(from);
      clearSourceGuardTimer();
      if (from && persistMs != null) {
        guardClearTimerRef.current = window.setTimeout(() => {
          guardClearTimerRef.current = null;
          setSourceGuardHref(null);
          recoveryRef.current = null;
        }, persistMs);
      }
    },
    [clearSourceGuardTimer],
  );

  const clearPending = useCallback(
    (opts?: { recover?: boolean }) => {
      const from = pendingFromRef.current;
      const to = pendingTargetRef.current;
      const raw = pendingRawHrefRef.current;
      if (opts?.recover && from && to && raw) {
        recoveryRef.current = {
          from,
          to,
          raw,
          until: Date.now() + PENDING_RECOVERY_MS,
        };
        holdSourceGuard(from, PENDING_RECOVERY_MS);
      } else {
        recoveryRef.current = null;
        holdSourceGuard(null);
      }
      pendingTargetRef.current = null;
      pendingFromRef.current = null;
      pendingRawHrefRef.current = null;
      endSoftNavFlight();
      setPendingHref(null);
      clearTimers();
    },
    [clearTimers, holdSourceGuard],
  );

  const pushRaw = useCallback(
    (raw: string) => {
      pendingRawHrefRef.current = raw;
      flushSoftNavPush(router);
      window.setTimeout(() => {
        router.push(raw);
      }, 0);
    },
    [router],
  );

  const tryRepush = useCallback(() => {
    const raw = pendingRawHrefRef.current;
    const target = pendingTargetRef.current;
    const from = pendingFromRef.current;
    if (!raw || !target) return false;
    if (!shouldRepushSoftNav(pathnameRef.current, from, target)) {
      return false;
    }
    const now = Date.now();
    if (now - lastRepushAtRef.current < PENDING_REPUSH_GAP_MS) return false;
    if (repushCountRef.current >= PENDING_MAX_REPUSH) return false;
    lastRepushAtRef.current = now;
    repushCountRef.current += 1;
    pushRaw(raw);
    return true;
  }, [pushRaw]);

  const armSourceRetry = useCallback(
    (ms: number) => {
      if (sourceRetryTimerRef.current != null) {
        window.clearTimeout(sourceRetryTimerRef.current);
      }
      sourceRetryTimerRef.current = window.setTimeout(() => {
        sourceRetryTimerRef.current = null;
        const target = pendingTargetRef.current;
        const from = pendingFromRef.current;
        if (target == null) return;
        if (isSoftNavPendingArrived(pathnameRef.current, target)) return;
        if (shouldAbandonSoftNavPending(pathnameRef.current, from, target)) {
          clearPending();
          return;
        }
        tryRepush();
        armSourceRetry(Math.min(Math.round(ms * 1.35), 700));
      }, ms);
    },
    [clearPending, tryRepush],
  );

  const armGiveUp = useCallback(() => {
    if (giveUpTimerRef.current != null) {
      window.clearTimeout(giveUpTimerRef.current);
    }
    giveUpTimerRef.current = window.setTimeout(() => {
      giveUpTimerRef.current = null;
      const target = pendingTargetRef.current;
      if (target == null) return;
      if (isSoftNavPendingArrived(pathnameRef.current, target)) return;
      clearPending();
    }, PENDING_GIVE_UP_MS);
  }, [clearPending]);

  const restorePending = useCallback(
    (raw: string, from: string) => {
      const target = normalizeNavHref(raw);
      pendingTargetRef.current = target;
      pendingFromRef.current = normalizeNavHref(from);
      pendingRawHrefRef.current = raw;
      beginSoftNavFlight(raw);
      setPendingHref(target);
      holdSourceGuard(normalizeNavHref(from));
      armGiveUp();
      armSourceRetry(PENDING_SOURCE_RETRY_MS);
    },
    [armGiveUp, armSourceRetry, holdSourceGuard],
  );

  // Vor Paint: Revert abfangen, sonst blitzt Dashboard eine Frame.
  useLayoutEffect(() => {
    const recovery = recoveryRef.current;
    if (pendingTargetRef.current == null && recovery) {
      if (Date.now() > recovery.until) {
        recoveryRef.current = null;
        return;
      }
      if (isSoftNavPendingArrived(pathname, recovery.to)) return;
      if (shouldAbandonSoftNavPending(pathname, recovery.from, recovery.to)) {
        recoveryRef.current = null;
        holdSourceGuard(null);
        return;
      }
      lastRepushAtRef.current = 0;
      repushCountRef.current = 0;
      restorePending(recovery.raw, recovery.from);
      tryRepush();
      return;
    }

    const target = pendingTargetRef.current;
    if (target == null) return;

    if (
      shouldAbandonSoftNavPending(pathname, pendingFromRef.current, target)
    ) {
      clearPending();
      return;
    }

    if (isSoftNavPendingArrived(pathname, target)) {
      if (sourceRetryTimerRef.current != null) {
        window.clearTimeout(sourceRetryTimerRef.current);
        sourceRetryTimerRef.current = null;
      }
      if (arrivedStableTimerRef.current != null) return;
      arrivedStableTimerRef.current = window.setTimeout(() => {
        arrivedStableTimerRef.current = null;
        if (
          pendingTargetRef.current === target &&
          isSoftNavPendingArrived(pathnameRef.current, target)
        ) {
          clearPending({ recover: true });
        }
      }, PENDING_ARRIVED_STABLE_MS);
      return;
    }

    if (arrivedStableTimerRef.current != null) {
      window.clearTimeout(arrivedStableTimerRef.current);
      arrivedStableTimerRef.current = null;
    }
    tryRepush();
    if (sourceRetryTimerRef.current == null) {
      armSourceRetry(PENDING_SOURCE_RETRY_MS);
    }
  }, [
    pathname,
    armSourceRetry,
    clearPending,
    holdSourceGuard,
    restorePending,
    tryRepush,
  ]);

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
      // Bereits unterwegs dorthin — kein zweites push (Race / Jump-back).
      if (pendingTargetRef.current === target) return false;

      recoveryRef.current = null;
      lastRepushAtRef.current = 0;
      repushCountRef.current = 0;
      if (arrivedStableTimerRef.current != null) {
        window.clearTimeout(arrivedStableTimerRef.current);
        arrivedStableTimerRef.current = null;
      }
      restorePending(targetHref, pathnameRef.current);
      return true;
    },
    [restorePending],
  );

  useEffect(
    () => () => {
      clearTimers();
      clearSourceGuardTimer();
    },
    [clearTimers, clearSourceGuardTimer],
  );

  return (
    <SoftNavLockContext.Provider
      value={{
        tryAcquireNavLock,
        pendingHref,
        sourceGuardHref,
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

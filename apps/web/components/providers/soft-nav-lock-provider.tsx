"use client";

import {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import {
  SoftNavLockContext,
  SOFT_NAV_LOCK_FALLBACK,
  normalizeNavHref,
  type SoftNavLockValue,
} from "@/lib/navigation/soft-nav-lock-context";
import {
  coalesceSoftNavPush,
  cancelSoftNavCoalescedPush,
  flushSoftNavPush,
} from "@/lib/navigation/soft-nav-coalesced-push";
import {
  beginSoftNavFlight,
  endSoftNavFlight,
} from "@/lib/navigation/soft-nav-flight";
import { isSoftNavPendingArrived } from "@/lib/navigation/module-home-keep-alive";

/** Erster Failsafe: ein Retry, dann Hard-Clear — Pending darf nie hängen. */
const PENDING_CLEAR_FAILSAFE_MS = 4_500;
const PENDING_RETRY_EXTRA_MS = 2_500;
/** Absolute Obergrenze inkl. Retry — Overlay/Flight immer weg. */
const PENDING_HARD_CLEAR_MS = 8_000;

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
  const hardClearTimerRef = useRef<number | null>(null);
  const paintClearRafRef = useRef<number | null>(null);
  const failsafeRetriedRef = useRef(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const clearPending = useCallback(() => {
    pendingTargetRef.current = null;
    pendingRawHrefRef.current = null;
    failsafeRetriedRef.current = false;
    cancelSoftNavCoalescedPush();
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

  const armHardClear = useCallback(() => {
    if (hardClearTimerRef.current != null) {
      window.clearTimeout(hardClearTimerRef.current);
    }
    hardClearTimerRef.current = window.setTimeout(() => {
      hardClearTimerRef.current = null;
      clearPending();
    }, PENDING_HARD_CLEAR_MS);
  }, [clearPending]);

  // Ziel erreicht → Cover nach einem Paint heben (kein Weiß/Dashboard-Flash).
  useEffect(() => {
    const target = pendingTargetRef.current;
    if (target == null) return;
    if (!isSoftNavPendingArrived(pathname, target)) return;

    const raf = window.requestAnimationFrame(() => {
      paintClearRafRef.current = null;
      if (
        pendingTargetRef.current === target &&
        isSoftNavPendingArrived(pathnameRef.current, target)
      ) {
        clearPending();
      }
    });
    paintClearRafRef.current = raf;

    return () => {
      window.cancelAnimationFrame(raf);
      if (paintClearRafRef.current === raf) {
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

      // Pending-Chrome sofort painten, bevor der Microtask-Push läuft —
      // fühlt sich auf Mobile spürbar direkter an.
      flushSync(() => {
        setPendingHref(target);
      });
      armFailsafe(PENDING_CLEAR_FAILSAFE_MS);
      armHardClear();
      return true;
    },
    [armFailsafe, armHardClear],
  );

  // bfcache / Tab-Freeze: Pending nie „ewig“ stehen lassen.
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
      if (paintClearRafRef.current != null) {
        window.cancelAnimationFrame(paintClearRafRef.current);
      }
      cancelSoftNavCoalescedPush();
      endSoftNavFlight();
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

/** Layout-level consumers (z. B. Readiness) — kein Throw vor Dashboard-SPA-Shell. */
export function useSoftNavLockOptional(): SoftNavLockValue {
  return useContext(SoftNavLockContext) ?? SOFT_NAV_LOCK_FALLBACK;
}

export { normalizeNavHref };

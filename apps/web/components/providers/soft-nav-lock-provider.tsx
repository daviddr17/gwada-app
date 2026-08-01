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
import { usePathname } from "next/navigation";

type SoftNavLockValue = {
  tryAcquireNavLock: (
    event: { preventDefault: () => void },
    targetHref: string,
  ) => boolean;
  /** Ziel-Route während Soft-Nav — Sidebar + Pending-Overlay. */
  pendingHref: string | null;
};

const SoftNavLockContext = createContext<SoftNavLockValue | null>(null);

const PENDING_CLEAR_FAILSAFE_MS = 8_000;

export function normalizeNavHref(href: string): string {
  const path = href.split("?")[0]?.split("#")[0] ?? href;
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path || "/dashboard";
}

/**
 * Soft-Nav Pending — sofortiges UI-Feedback (Sidebar + Overlay).
 * Doppel-`router.push` auf dasselbe Ziel wird blockiert; neues Ziel ersetzt
 * das Pending (letzter Klick gewinnt).
 *
 * Pending bleibt gesetzt, bis die Ziel-URL wirklich erreicht ist und einmal
 * gepaintet wurde — sonst weißer Flash / Dashboard-Blitzen unter dem Titel.
 */
export function SoftNavLockProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const pendingTargetRef = useRef<string | null>(null);
  const clearTimerRef = useRef<number | null>(null);
  const paintClearRafRef = useRef<number | null>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const clearPending = useCallback(() => {
    pendingTargetRef.current = null;
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

  // Ziel erreicht → Cover erst nach Paint heben (kein Weiß/Dashboard-Flash).
  useEffect(() => {
    const target = pendingTargetRef.current;
    if (target == null) return;
    if (normalizeNavHref(pathname) !== target) return;

    let raf2: number | null = null;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        paintClearRafRef.current = null;
        // Nur clearen, wenn wir noch dasselbe Ziel erwarten.
        if (pendingTargetRef.current === target) {
          clearPending();
        }
      });
      paintClearRafRef.current = raf2;
    });
    paintClearRafRef.current = raf1;

    return () => {
      window.cancelAnimationFrame(raf1);
      if (raf2 != null) window.cancelAnimationFrame(raf2);
      if (paintClearRafRef.current === raf1 || paintClearRafRef.current === raf2) {
        paintClearRafRef.current = null;
      }
    };
  }, [pathname, clearPending]);

  const tryAcquireNavLock = useCallback(
    (_event: { preventDefault: () => void }, targetHref: string) => {
      const target = normalizeNavHref(targetHref);
      // Bereits unterwegs dorthin — kein zweites push (Race / Jump-back).
      if (pendingTargetRef.current === target) return false;

      pendingTargetRef.current = target;
      if (clearTimerRef.current != null) {
        window.clearTimeout(clearTimerRef.current);
        clearTimerRef.current = null;
      }
      if (paintClearRafRef.current != null) {
        window.cancelAnimationFrame(paintClearRafRef.current);
        paintClearRafRef.current = null;
      }

      // Synchron: Nutzer sieht sofort Ziel-Titel/Skeleton — kein „nichts tun“.
      setPendingHref(target);
      clearTimerRef.current = window.setTimeout(
        clearPending,
        PENDING_CLEAR_FAILSAFE_MS,
      );
      return true;
    },
    [clearPending],
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
    <SoftNavLockContext.Provider value={{ tryAcquireNavLock, pendingHref }}>
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

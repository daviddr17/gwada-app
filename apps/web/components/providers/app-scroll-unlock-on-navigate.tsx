"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  forceResetAppScrollLocks,
  scrollAppRootToTop,
} from "@/lib/layout/app-scroll-root";
import { matchModuleHomeId } from "@/lib/navigation/module-home-keep-alive";

/**
 * Soft-Nav / Overlay-Cleanup: nach Modulwechsel hängende Scroll-Locks lösen
 * und den gemeinsamen Scroll-Root oben starten (außer Keep-alive-Homes — die
 * stellen ihre eigene Position wieder her).
 */
export function AppScrollUnlockOnNavigate() {
  const pathname = usePathname();
  const prevScrollPathRef = useRef<string | null>(null);
  const prevUnlockPathRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    const prev = prevScrollPathRef.current;
    prevScrollPathRef.current = pathname;
    if (prev === null || prev === pathname) return;

    // Keep-alive-Homes: Slot restored gespeicherte Position (nicht zwangsweise 0).
    if (matchModuleHomeId(pathname) != null) return;

    scrollAppRootToTop();
  }, [pathname]);

  useEffect(() => {
    const prev = prevUnlockPathRef.current;
    prevUnlockPathRef.current = pathname;
    if (prev === null || prev === pathname) return;

    // Sofort + nach Overlay-Close-Animation (Chrome ~480ms, Drawer ähnlich).
    forceResetAppScrollLocks();
    const t1 = window.setTimeout(() => forceResetAppScrollLocks(), 120);
    const t2 = window.setTimeout(() => forceResetAppScrollLocks(), 520);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [pathname]);

  return null;
}

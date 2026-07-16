"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { forceResetAppScrollLocks } from "@/lib/layout/app-scroll-root";

/**
 * Soft-Nav / Overlay-Cleanup: nach Modulwechsel hängende Scroll-Locks lösen
 * (Chrome-Sheet, Drawer, Dialog, Base UI `data-base-ui-scroll-locked`).
 */
export function AppScrollUnlockOnNavigate() {
  const pathname = usePathname();
  const prevPathnameRef = useRef<string | null>(null);

  useEffect(() => {
    const prev = prevPathnameRef.current;
    prevPathnameRef.current = pathname;
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

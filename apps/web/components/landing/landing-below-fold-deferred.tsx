"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";

/**
 * Lädt framer-schwere Scroll-/Pricing-Sections erst nach Idle oder Nähe zum Viewport —
 * kein eager Script-Preload mit dem Hero.
 */
export function LandingBelowFoldDeferred() {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);
  const [BelowFold, setBelowFold] = useState<ComponentType | null>(null);

  useEffect(() => {
    let cancelled = false;
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let io: IntersectionObserver | undefined;

    const load = () => {
      if (cancelled || loadedRef.current) return;
      loadedRef.current = true;
      void import("@/components/landing/landing-below-fold").then((m) => {
        if (!cancelled) setBelowFold(() => m.LandingBelowFold);
      });
    };

    io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) load();
      },
      { rootMargin: "280px 0px" },
    );
    if (sentinelRef.current) io.observe(sentinelRef.current);

    const win = window as Window & {
      requestIdleCallback?: (
        cb: () => void,
        opts?: { timeout: number },
      ) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    // Touch: Framer-Sections später — PageSpeed Mobile TBT/SI.
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (typeof win.requestIdleCallback === "function") {
      idleId = win.requestIdleCallback(load, {
        timeout: coarse ? 7000 : 4000,
      });
    } else {
      timeoutId = setTimeout(load, coarse ? 4200 : 2200);
    }

    return () => {
      cancelled = true;
      io?.disconnect();
      if (idleId !== undefined) win.cancelIdleCallback?.(idleId);
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, []);

  return (
    <>
      <div ref={sentinelRef} className="h-px w-full" aria-hidden />
      {BelowFold ? (
        <BelowFold />
      ) : (
        <>
          <div className="min-h-[80vh]" aria-hidden />
          <div className="min-h-[70vh]" aria-hidden />
          <div className="min-h-[65vh]" aria-hidden />
        </>
      )}
    </>
  );
}

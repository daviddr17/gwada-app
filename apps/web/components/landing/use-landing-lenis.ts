"use client";

import type Lenis from "lenis";
import { useEffect, useRef, type RefObject } from "react";

/**
 * Butterweiches Scrollen nur für die Marketing-Landing (Lenis RAF-Loop).
 * Nur feiner Pointer (Maus/Trackpad) — auf Touch natives Scrollen (PageSpeed/SI).
 * Start verzögert (idle), damit Hero schneller interaktiv ist.
 */
export function useLandingLenis(): RefObject<Lenis | null> {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) {
      return;
    }

    let lenis: Lenis | null = null;
    let raf = 0;
    let cancelled = false;
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const start = async () => {
      if (cancelled) return;
      const { default: LenisCtor } = await import("lenis");
      if (cancelled) return;
      lenis = new LenisCtor({
        duration: 1.15,
        smoothWheel: true,
        wheelMultiplier: 0.92,
        touchMultiplier: 1.05,
        easing: (t) => Math.min(1, 1.001 - 2 ** (-10 * t)),
      });
      lenisRef.current = lenis;

      const tick = (time: number) => {
        lenis?.raf(time);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    if (typeof requestIdleCallback !== "undefined") {
      idleId = requestIdleCallback(() => void start(), { timeout: 1800 });
    } else {
      timeoutId = setTimeout(() => void start(), 400);
    }

    return () => {
      cancelled = true;
      if (idleId !== undefined && typeof cancelIdleCallback !== "undefined") {
        cancelIdleCallback(idleId);
      }
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      cancelAnimationFrame(raf);
      lenis?.destroy();
      lenisRef.current = null;
    };
  }, []);

  return lenisRef;
}

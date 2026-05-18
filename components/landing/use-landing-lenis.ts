"use client";

import Lenis from "lenis";
import { useEffect, useRef, type RefObject } from "react";

/**
 * Butterweiches Scrollen nur für die Marketing-Landing (Lenis RAF-Loop).
 * Wird beim Unmount sauber zerstört. Ref für programmatisches scrollTo (Dock, CTAs).
 */
export function useLandingLenis(): RefObject<Lenis | null> {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.15,
      smoothWheel: true,
      wheelMultiplier: 0.92,
      touchMultiplier: 1.05,
      easing: (t) => Math.min(1, 1.001 - 2 ** (-10 * t)),
    });
    lenisRef.current = lenis;

    let raf = 0;
    const tick = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  return lenisRef;
}

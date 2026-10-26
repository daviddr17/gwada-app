"use client";

import { useEffect, useState } from "react";

/**
 * Soft-Keyboard-Inset (px) für den Assistenten-Mobile-Sheet.
 * Nutzt visualViewport — Composer bleibt über der Tastatur sichtbar.
 */
export function useAssistantMobileKeyboardInset(active: boolean): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (!active || typeof window === "undefined") {
      setInset(0);
      return;
    }
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const next = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      // Kleine Jitter / URL-Bar ignorieren
      setInset(next > 48 ? Math.round(next) : 0);
    };

    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      setInset(0);
    };
  }, [active]);

  return inset;
}

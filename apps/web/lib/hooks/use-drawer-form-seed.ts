"use client";

import { useEffect, useRef } from "react";

/**
 * Formular in Drawern nur beim Öffnen / Wechsel der Seed-Key hydrieren.
 * Verhindert, dass tippende Inputs durch neue Object-/Array-Referenzen
 * (Realtime, Default `=[]`, nachgeladenes `countries`/`statuses`) zurückgesetzt werden.
 */
export function useDrawerFormSeed(
  open: boolean,
  seedKey: string,
  hydrate: () => void,
): void {
  const wasOpenRef = useRef(false);
  const seededForKeyRef = useRef<string | null>(null);
  const hydrateRef = useRef(hydrate);
  hydrateRef.current = hydrate;

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      seededForKeyRef.current = null;
      return;
    }
    const justOpened = !wasOpenRef.current;
    wasOpenRef.current = true;
    if (!justOpened && seededForKeyRef.current === seedKey) return;
    seededForKeyRef.current = seedKey;

    const frame = requestAnimationFrame(() => {
      hydrateRef.current();
    });
    return () => cancelAnimationFrame(frame);
  }, [open, seedKey]);
}

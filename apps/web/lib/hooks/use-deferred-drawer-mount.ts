"use client";

import { useEffect, useState } from "react";

/**
 * Schweren Drawer-Inhalt erst nach dem Vaul-Open-Frame mounten.
 * Sonst blockiert ein großes Formular die Slide-up-Animation.
 */
export function useDeferredDrawerMount(open: boolean): boolean {
  const [mountContent, setMountContent] = useState(false);

  useEffect(() => {
    if (!open) {
      setMountContent(false);
      return;
    }
    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => setMountContent(true));
    });
    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
    };
  }, [open]);

  return mountContent;
}

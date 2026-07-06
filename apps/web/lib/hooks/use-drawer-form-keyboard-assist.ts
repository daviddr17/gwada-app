"use client";

import { useEffect, useState, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [contenteditable="true"]';

/** iPhone, iPod, iPad (inkl. iPadOS mit Desktop-UA). */
export function isIosTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  const { navigator } = window;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

type UseDrawerFormKeyboardAssistOptions = {
  open: boolean;
  scrollRef: RefObject<HTMLElement | null>;
};

/**
 * Formular-Bottom-Sheets auf iOS: vaul `repositionInputs` nur solange offen,
 * plus lokales scrollIntoView im Drawer-Scroll — nicht auf Document-Ebene.
 */
export function useDrawerFormKeyboardAssist({
  open,
  scrollRef,
}: UseDrawerFormKeyboardAssistOptions): { repositionInputs: boolean } {
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setIos(isIosTouchDevice());
  }, []);

  const enabled = open && ios;

  useEffect(() => {
    if (!enabled) return;
    const root = scrollRef.current;
    if (!root) return;

    let raf = 0;
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!root.contains(target)) return;
      if (!target.matches(FOCUSABLE_SELECTOR)) return;

      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        target.scrollIntoView({ block: "nearest", inline: "nearest" });
      });
    };

    root.addEventListener("focusin", onFocusIn);
    return () => {
      cancelAnimationFrame(raf);
      root.removeEventListener("focusin", onFocusIn);
    };
  }, [enabled, scrollRef]);

  return { repositionInputs: enabled };
}

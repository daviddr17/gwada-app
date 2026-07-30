"use client";

import { useEffect, type RefObject } from "react";

/** Publishes an element’s border-box height to a CSS custom property (ResizeObserver). */
export function useCssVarElementHeight(
  ref: RefObject<HTMLElement | null>,
  cssVar: string,
): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const root = document.documentElement;
    const apply = () => {
      root.style.setProperty(cssVar, `${el.offsetHeight}px`);
    };
    apply();

    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty(cssVar);
    };
  }, [ref, cssVar]);
}

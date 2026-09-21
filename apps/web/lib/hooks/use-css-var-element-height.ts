"use client";

import { useEffect, type RefObject } from "react";

/**
 * Publishes an element’s border-box height to a CSS custom property (ResizeObserver).
 *
 * @param observeKey — change this when the element mounts conditionally (e.g. after
 *   skeleton/loading). The ref object identity alone does not re-run the effect.
 */
export function useCssVarElementHeight(
  ref: RefObject<HTMLElement | null>,
  cssVar: string,
  observeKey?: string | number | boolean,
): void {
  useEffect(() => {
    const root = document.documentElement;
    let ro: ResizeObserver | undefined;
    let raf = 0;
    let tries = 0;

    const apply = () => {
      const current = ref.current;
      if (!current) return;
      root.style.setProperty(cssVar, `${current.offsetHeight}px`);
    };

    const detach = () => {
      if (ro) {
        ro.disconnect();
        ro = undefined;
      }
    };

    const attach = (): boolean => {
      const el = ref.current;
      if (!el) return false;
      detach();
      apply();
      if (typeof ResizeObserver !== "undefined") {
        ro = new ResizeObserver(apply);
        ro.observe(el);
      }
      return true;
    };

    const tryAttach = () => {
      if (attach()) return;
      // Conditional mounts (skeleton → content) often land after the first effect.
      if (++tries > 90) return;
      raf = requestAnimationFrame(tryAttach);
    };

    tryAttach();

    return () => {
      cancelAnimationFrame(raf);
      detach();
      root.style.removeProperty(cssVar);
    };
  }, [ref, cssVar, observeKey]);
}

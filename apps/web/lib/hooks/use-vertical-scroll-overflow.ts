"use client";

import { useCallback, useEffect, useState, type RefCallback } from "react";

const EDGE_PX = 8;

export type VerticalScrollOverflow = {
  canScrollUp: boolean;
  canScrollDown: boolean;
};

function measureVerticalOverflow(el: HTMLElement | null): VerticalScrollOverflow {
  if (!el) return { canScrollUp: false, canScrollDown: false };
  const { scrollTop, scrollHeight, clientHeight } = el;
  const maxScroll = scrollHeight - clientHeight;
  if (maxScroll <= EDGE_PX) {
    return { canScrollUp: false, canScrollDown: false };
  }
  return {
    canScrollUp: scrollTop > EDGE_PX,
    canScrollDown: scrollTop < maxScroll - EDGE_PX,
  };
}

/** Erkennt vertikalen Überlauf und Scroll-Position (Resize + Inhalt + Scroll). */
export function useVerticalScrollOverflow() {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [overflow, setOverflow] = useState<VerticalScrollOverflow>({
    canScrollUp: false,
    canScrollDown: false,
  });

  const ref = useCallback<RefCallback<HTMLElement>>((el) => {
    setNode(el);
  }, []);

  const scrollByPage = useCallback(
    (direction: "up" | "down") => {
      if (!node) return;
      const delta = Math.max(120, Math.round(node.clientHeight * 0.72));
      node.scrollBy({
        top: direction === "down" ? delta : -delta,
        behavior: "smooth",
      });
    },
    [node],
  );

  useEffect(() => {
    if (!node) return;

    const update = () => {
      setOverflow(measureVerticalOverflow(node));
    };

    update();

    const ro = new ResizeObserver(update);
    ro.observe(node);

    const mo = new MutationObserver(update);
    mo.observe(node, { childList: true, subtree: true, characterData: true });

    node.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    return () => {
      ro.disconnect();
      mo.disconnect();
      node.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [node]);

  return {
    ref,
    canScrollUp: overflow.canScrollUp,
    canScrollDown: overflow.canScrollDown,
    scrollByPage,
  };
}

"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

export function useSlidingTabHighlight<T extends { id: string }>({
  items,
  value,
}: {
  items: readonly T[];
  value: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const activeIndex = items.findIndex((item) => item.id === value);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const highlightIndex = hoverIndex ?? (activeIndex >= 0 ? activeIndex : 0);
  const [highlight, setHighlight] = useState({ left: 0, width: 0 });

  const measureHighlight = useCallback(() => {
    const container = containerRef.current;
    const item = items[highlightIndex];
    if (!item || !container) return;
    const btn = tabRefs.current.get(item.id);
    if (!btn) return;
    setHighlight({ left: btn.offsetLeft, width: btn.offsetWidth });
  }, [highlightIndex, items]);

  useLayoutEffect(() => {
    measureHighlight();
  }, [measureHighlight, value, highlightIndex]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => measureHighlight());
    ro.observe(container);
    window.addEventListener("resize", measureHighlight);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measureHighlight);
    };
  }, [measureHighlight]);

  return {
    containerRef,
    tabRefs,
    highlightIndex,
    highlight,
    setHoverIndex,
    clearHover: () => setHoverIndex(null),
  };
}

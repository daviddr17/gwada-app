"use client";

import { useCallback, useEffect, useState, type RefCallback } from "react";

function measureHorizontalOverflow(el: HTMLElement | null): boolean {
  if (!el) return false;
  return el.scrollWidth > el.clientWidth + 1;
}

/** Erkennt horizontalen Überlauf am Scroll-Container (Resize + Inhalt). */
export function useTableHorizontalScroll() {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [canScrollX, setCanScrollX] = useState(false);

  const ref = useCallback<RefCallback<HTMLElement>>((el) => {
    setNode(el);
  }, []);

  useEffect(() => {
    if (!node) return;

    const update = () => {
      setCanScrollX(measureHorizontalOverflow(node));
    };

    update();

    const ro = new ResizeObserver(update);
    ro.observe(node);

    const table = node.querySelector("table");
    if (table) ro.observe(table);

    window.addEventListener("resize", update);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [node]);

  return { ref, canScrollX };
}

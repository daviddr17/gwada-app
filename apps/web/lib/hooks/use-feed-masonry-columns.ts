"use client";

import { useEffect, useState } from "react";

export function useFeedMasonryColumns(
  resolveCount: (viewportWidth: number) => number,
): { columnCount: number; mounted: boolean } {
  const [columnCount, setColumnCount] = useState(() => resolveCount(1024));
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const update = () => setColumnCount(resolveCount(window.innerWidth));
    setMounted(true);
    update();
    window.addEventListener("resize", update, { passive: true });
    return () => window.removeEventListener("resize", update);
  }, [resolveCount]);

  return { columnCount, mounted };
}

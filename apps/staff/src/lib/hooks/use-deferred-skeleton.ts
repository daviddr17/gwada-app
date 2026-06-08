import { useEffect, useState } from "react";

export const DEFERRED_SKELETON_MS = 120;

export function useDeferredSkeleton(
  loading: boolean,
  delayMs = DEFERRED_SKELETON_MS,
): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!loading) {
      setVisible(false);
      return;
    }
    const id = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(id);
  }, [loading, delayMs]);

  return visible;
}

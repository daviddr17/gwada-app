import { useEffect, useState } from "react";

/** Default: genug Zeit für synchronen Cache/LS, ohne sichtbaren Skeleton-Flash. */
export const DEFERRED_SKELETON_MS = 120;

/**
 * Liefert `true`, wenn `loading` mindestens `delayMs` lang ununterbrochen `true` war.
 * Sobald `loading` `false` wird, sofort `false` (kein „hängender“ Skeleton).
 */
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
    const id = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(id);
  }, [loading, delayMs]);
  return visible;
}

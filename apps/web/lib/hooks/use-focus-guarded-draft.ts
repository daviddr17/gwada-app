"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Controlled draft string that syncs from an external value — but never while
 * the field is focused (Realtime/refetch must not wipe mid-typing).
 */
export function useFocusGuardedDraft(
  externalValue: string | number,
  resetKey?: string,
): {
  draft: string;
  setDraft: (next: string) => void;
  focusProps: {
    onFocus: () => void;
    onBlurCapture: () => void;
  };
} {
  const [draft, setDraft] = useState(() => String(externalValue));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (focusedRef.current) return;
    setDraft(String(externalValue));
  }, [externalValue, resetKey]);

  return {
    draft,
    setDraft,
    focusProps: {
      onFocus: () => {
        focusedRef.current = true;
      },
      onBlurCapture: () => {
        focusedRef.current = false;
      },
    },
  };
}

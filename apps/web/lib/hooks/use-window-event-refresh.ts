"use client";

import { useEffect, useRef } from "react";

/** Ruft onRefresh bei einem Window-Event auf — nur Lesen/Refetch, kein Persist. */
export function useWindowEventRefresh(eventName: string, enabled: boolean, onRefresh: () => void) {
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    if (!enabled) return;
    const onEvent = () => {
      onRefreshRef.current();
    };
    window.addEventListener(eventName, onEvent);
    return () => window.removeEventListener(eventName, onEvent);
  }, [enabled, eventName]);
}

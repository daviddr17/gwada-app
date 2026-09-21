"use client";

import { useEffect, useRef } from "react";
import { GWADA_INVENTORY_DATA_REFRESH_EVENT } from "@/lib/inventory/inventory-live-events";

/**
 * Refetch/invalidate inventory React Query caches when Realtime or fallback poll fires.
 */
export function useInventoryDataRefreshListener(
  enabled: boolean,
  onRefresh: () => void,
) {
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    if (!enabled) return;

    const onEvent = () => {
      onRefreshRef.current();
    };

    window.addEventListener(GWADA_INVENTORY_DATA_REFRESH_EVENT, onEvent);
    return () => {
      window.removeEventListener(GWADA_INVENTORY_DATA_REFRESH_EVENT, onEvent);
    };
  }, [enabled]);
}

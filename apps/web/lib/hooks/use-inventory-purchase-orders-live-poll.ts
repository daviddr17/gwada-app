"use client";

import { useCallback, useEffect, useRef } from "react";
import { fetchInventoryPurchaseOrdersLiveRevision } from "@/lib/inventory/inventory-purchase-orders-live-revision";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const DEFAULT_POLL_MS = 2_000;
const DEFAULT_RECONCILE_MS = 400;

/**
 * Polls PO line/log counts so Dashboard Bestellungen refreshes after Display saves.
 */
export function useInventoryPurchaseOrdersLivePoll(
  enabled: boolean,
  restaurantId: string | null | undefined,
  onRefresh: () => void,
) {
  const lastRevisionRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const reconcileRef = useRef<number | null>(null);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const scheduleRefresh = useCallback(() => {
    if (reconcileRef.current) {
      window.clearTimeout(reconcileRef.current);
    }
    reconcileRef.current = window.setTimeout(() => {
      reconcileRef.current = null;
      onRefreshRef.current();
    }, DEFAULT_RECONCILE_MS);
  }, []);

  useEffect(() => {
    if (!enabled || !restaurantId) {
      lastRevisionRef.current = null;
      initializedRef.current = false;
      return;
    }

    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    const tick = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        const revision = await fetchInventoryPurchaseOrdersLiveRevision(
          supabase,
          restaurantId,
        );
        if (cancelled) return;
        if (!initializedRef.current) {
          initializedRef.current = true;
          lastRevisionRef.current = revision;
          return;
        }
        if (lastRevisionRef.current === revision) return;
        lastRevisionRef.current = revision;
        scheduleRefresh();
      } catch {
        /* background poll */
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), DEFAULT_POLL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      if (reconcileRef.current) {
        window.clearTimeout(reconcileRef.current);
        reconcileRef.current = null;
      }
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, restaurantId, scheduleRefresh]);
}

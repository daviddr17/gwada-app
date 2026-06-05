"use client";

import { useCallback, useEffect, useState } from "react";
import {
  GWADA_DASHBOARD_WIDGETS_REFRESH_EVENT,
  useDashboardHasDataRef,
} from "@/lib/dashboard/dashboard-widget-refresh";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT } from "@/lib/supabase/workspace-persistence";

const EMPTY_REFRESH_EVENTS: readonly string[] = [];

export function useDashboardSummaryQuery<T>(options: {
  restaurantId: string | null;
  workspaceReady: boolean;
  fetch: (
    restaurantId: string,
  ) => Promise<{ data: T | null; error: string | null }>;
  /** Realtime o. Ä. — stilles Nachladen. */
  extraRefreshEvents?: readonly string[];
}) {
  const {
    restaurantId,
    workspaceReady,
    fetch,
    extraRefreshEvents = EMPTY_REFRESH_EVENTS,
  } = options;
  const hasDataRef = useDashboardHasDataRef();
  const [summary, setSummary] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshEventsKey = extraRefreshEvents.join("\0");

  const run = useCallback(
    async (silent: boolean) => {
      if (!restaurantId || !isUuidRestaurantId(restaurantId)) return;

      const initial = !hasDataRef.current;
      if (!silent && initial) setLoading(true);
      if (!silent) setError(null);

      const { data, error: err } = await fetch(restaurantId);

      if (err) {
        if (!hasDataRef.current) {
          setSummary(null);
          setError(err);
        }
      } else {
        setSummary(data);
        hasDataRef.current = data != null;
      }

      if (!silent && initial) setLoading(false);
    },
    [restaurantId, fetch],
  );

  useEffect(() => {
    if (!restaurantId || !isUuidRestaurantId(restaurantId)) {
      hasDataRef.current = false;
      setSummary(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancel = false;
    hasDataRef.current = false;

    const load = async (silent: boolean) => {
      if (cancel) return;
      await run(silent);
    };

    void load(false);

    const onPoll = () => void load(true);
    const onRestaurantChange = () => {
      hasDataRef.current = false;
      void load(false);
    };

    window.addEventListener(GWADA_DASHBOARD_WIDGETS_REFRESH_EVENT, onPoll);
    window.addEventListener(
      GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT,
      onRestaurantChange,
    );
    for (const ev of extraRefreshEvents) {
      window.addEventListener(ev, onPoll);
    }

    return () => {
      cancel = true;
      window.removeEventListener(GWADA_DASHBOARD_WIDGETS_REFRESH_EVENT, onPoll);
      window.removeEventListener(
        GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT,
        onRestaurantChange,
      );
      for (const ev of extraRefreshEvents) {
        window.removeEventListener(ev, onPoll);
      }
    };
  }, [restaurantId, run, refreshEventsKey]);

  return {
    summary,
    loading,
    error,
    ready: workspaceReady && Boolean(restaurantId && isUuidRestaurantId(restaurantId)),
  };
}

"use client";

import { useCallback, useEffect, useState } from "react";
import type { DashboardCalendarSummary } from "@/lib/dashboard/dashboard-calendar-types";

export function useDashboardCalendarSummary(
  restaurantId: string | null,
  month: string,
): {
  data: DashboardCalendarSummary | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
} {
  const [data, setData] = useState<DashboardCalendarSummary | null>(null);
  const [loading, setLoading] = useState(Boolean(restaurantId && month));
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!restaurantId || !/^\d{4}-\d{2}$/.test(month)) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      restaurantId,
      month,
    });
    void fetch(`/api/dashboard/calendar/summary?${params}`)
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as {
          data?: DashboardCalendarSummary;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !json.data) {
          setData(null);
          setError(json.error ?? "Kalender konnte nicht geladen werden.");
          return;
        }
        setData(json.data);
        setError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setData(null);
        setError("Kalender konnte nicht geladen werden.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [restaurantId, month, nonce]);

  return { data, loading, error, reload };
}

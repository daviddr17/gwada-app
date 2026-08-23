"use client";

import { useCallback, useEffect, useState } from "react";
import type { DashboardCalendarSummary } from "@/lib/dashboard/dashboard-calendar-types";

const CALENDAR_FETCH_TIMEOUT_MS = 10_000;

const summaryCache = new Map<string, DashboardCalendarSummary>();

function cacheKey(restaurantId: string, month: string): string {
  return `${restaurantId}:${month}`;
}

export function useDashboardCalendarSummary(
  restaurantId: string | null,
  month: string,
): {
  data: DashboardCalendarSummary | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
} {
  const [data, setData] = useState<DashboardCalendarSummary | null>(() => {
    if (!restaurantId || !/^\d{4}-\d{2}$/.test(month)) return null;
    return summaryCache.get(cacheKey(restaurantId, month)) ?? null;
  });
  const [loading, setLoading] = useState(() => {
    if (!restaurantId || !/^\d{4}-\d{2}$/.test(month)) return false;
    return !summaryCache.has(cacheKey(restaurantId, month));
  });
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!restaurantId || !/^\d{4}-\d{2}$/.test(month)) {
      setLoading(false);
      setError(null);
      // Cache behalten — Overlay schließen darf nicht neu laden erzwingen.
      return;
    }

    const key = cacheKey(restaurantId, month);
    const cached = summaryCache.get(key) ?? null;
    if (cached) {
      setData(cached);
      setLoading(false);
      setError(null);
    } else {
      setData(null);
      setLoading(true);
      setError(null);
    }

    let cancelled = false;
    let timedOut = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, CALENDAR_FETCH_TIMEOUT_MS);

    const params = new URLSearchParams({
      restaurantId,
      month,
    });

    void fetch(`/api/dashboard/calendar/summary?${params}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as {
          data?: DashboardCalendarSummary;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !json.data) {
          if (!cached) {
            setData(null);
            setError(json.error ?? "Kalender konnte nicht geladen werden.");
          }
          return;
        }
        summaryCache.set(key, json.data);
        setData(json.data);
        setError(null);
      })
      .catch(() => {
        if (cancelled) return;
        if (cached) return;
        setData(null);
        setError(
          timedOut
            ? "Kalender braucht zu lange — bitte erneut versuchen."
            : "Kalender konnte nicht geladen werden.",
        );
      })
      .finally(() => {
        window.clearTimeout(timeout);
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [restaurantId, month, nonce]);

  return { data, loading, error, reload };
}

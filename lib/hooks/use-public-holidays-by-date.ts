"use client";

import { useEffect, useState } from "react";

export function usePublicHolidaysByDate(
  restaurantId: string | null,
  fromYmd: string,
  toYmd: string,
): {
  byDate: Record<string, string>;
  loading: boolean;
} {
  const [byDate, setByDate] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!restaurantId || !fromYmd || !toYmd || fromYmd > toYmd) {
      setByDate({});
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const params = new URLSearchParams({
      restaurantId,
      from: fromYmd,
      to: toYmd,
    });

    fetch(`/api/holidays/range?${params}`)
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
          byDate?: Record<string, string>;
        };
        if (!cancelled && res.ok && data.byDate) {
          setByDate(data.byDate);
        } else if (!cancelled) {
          setByDate({});
        }
      })
      .catch(() => {
        if (!cancelled) setByDate({});
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [restaurantId, fromYmd, toYmd]);

  return { byDate, loading };
}

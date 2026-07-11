"use client";

import { useEffect, useState } from "react";
import {
  peekPublicHolidaysCache,
  writePublicHolidaysCache,
} from "@/lib/reservations/public-holidays-range-cache";

export function usePublicHolidaysByDate(
  restaurantId: string | null,
  fromYmd: string,
  toYmd: string,
): {
  byDate: Record<string, string>;
  loading: boolean;
} {
  const [byDate, setByDate] = useState<Record<string, string>>(() => {
    if (!restaurantId || !fromYmd || !toYmd) return {};
    return peekPublicHolidaysCache(restaurantId, fromYmd, toYmd) ?? {};
  });
  const [loading, setLoading] = useState(() => {
    if (!restaurantId || !fromYmd || !toYmd) return false;
    return peekPublicHolidaysCache(restaurantId, fromYmd, toYmd) == null;
  });

  useEffect(() => {
    if (!restaurantId || !fromYmd || !toYmd || fromYmd > toYmd) {
      setByDate({});
      setLoading(false);
      return;
    }

    const cached = peekPublicHolidaysCache(restaurantId, fromYmd, toYmd);
    if (cached) {
      setByDate(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    let cancelled = false;

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
        if (cancelled) return;
        if (res.ok && data.byDate) {
          writePublicHolidaysCache(restaurantId, fromYmd, toYmd, data.byDate);
          setByDate(data.byDate);
        } else {
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

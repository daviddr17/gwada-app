"use client";

import { useCallback, useEffect, useState } from "react";
import type { OpeningHoursPlatformStatusPayload } from "@/lib/integrations/opening-hours-platform-status-types";

export function useOpeningHoursPlatformStatus(
  restaurantId: string | null,
  refreshKey = 0,
) {
  const [data, setData] = useState<OpeningHoursPlatformStatusPayload | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!restaurantId) {
      setData(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(
      `/api/integrations/opening-hours/platform-status?${new URLSearchParams({ restaurantId })}`,
      { cache: "no-store" },
    )
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as
          | OpeningHoursPlatformStatusPayload
          | { error?: string };
        if (cancelled) return;
        if (!res.ok || !("ok" in json) || !json.ok) {
          setData(null);
          setError(
            "error" in json && json.error
              ? json.error
              : "status_load_failed",
          );
          return;
        }
        setData(json);
      })
      .catch(() => {
        if (!cancelled) {
          setData(null);
          setError("status_load_failed");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  useEffect(() => {
    const cleanup = reload();
    return cleanup;
  }, [reload, refreshKey]);

  return { data, loading, error, reload };
}

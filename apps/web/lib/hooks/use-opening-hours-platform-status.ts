"use client";

import { useCallback, useEffect, useState } from "react";
import type { OpeningHoursPlatformStatusPayload } from "@/lib/integrations/opening-hours-platform-status-types";
import { PLATFORM_HOURS_STATUS_CLIENT_TIMEOUT_MS } from "@/lib/integrations/platform-api-timeout";

const RETRY_AFTER_SYNC_MS = 1_500;

function isRegularOutOfSync(data: OpeningHoursPlatformStatusPayload | null): boolean {
  return (
    data?.google.regular?.status === "out_of_sync" ||
    data?.facebook.regular?.status === "out_of_sync"
  );
}

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
    const retryAfterSync = refreshKey > 0;
    setLoading(true);
    setError(null);

    const loadOnce = async () => {
      const res = await fetch(
        `/api/integrations/opening-hours/platform-status?${new URLSearchParams({ restaurantId })}`,
        {
          cache: "no-store",
          signal: AbortSignal.timeout(PLATFORM_HOURS_STATUS_CLIENT_TIMEOUT_MS),
        },
      );
      const json = (await res.json().catch(() => ({}))) as
        | OpeningHoursPlatformStatusPayload
        | { error?: string };
      if (!res.ok || !("ok" in json) || !json.ok) {
        return {
          ok: false as const,
          error:
            "error" in json && json.error ? json.error : "status_load_failed",
        };
      }
      return { ok: true as const, data: json };
    };

    void (async () => {
      try {
        let result = await loadOnce();
        if (
          result.ok &&
          retryAfterSync &&
          isRegularOutOfSync(result.data)
        ) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_AFTER_SYNC_MS));
          if (cancelled) return;
          result = await loadOnce();
        }
        if (cancelled) return;
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setData(result.data);
      } catch {
        if (!cancelled) setError("status_load_failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [restaurantId, refreshKey]);

  useEffect(() => {
    const cleanup = reload();
    return cleanup;
  }, [reload]);

  return { data, loading, error, reload };
}

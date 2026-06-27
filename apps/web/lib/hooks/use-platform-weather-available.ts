"use client";

import { useCallback, useEffect, useState } from "react";

export type PlatformWeatherAvailableState = {
  available: boolean;
  loading: boolean;
};

export function usePlatformWeatherAvailable(): PlatformWeatherAvailableState {
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/weather/status", { cache: "no-store" });
      if (!res.ok) {
        setAvailable(false);
        return;
      }
      const data = (await res.json()) as { available?: boolean };
      setAvailable(data.available === true);
    } catch {
      setAvailable(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  return { available, loading };
}

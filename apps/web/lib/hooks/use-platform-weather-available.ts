"use client";

import { useCallback, useEffect, useState } from "react";

export type PlatformWeatherAvailableState = {
  available: boolean;
  loading: boolean;
};

/** Letzter bestätigter Status — überlebt Remount/Soft-Nav ohne Flackern. */
let cachedPlatformWeatherAvailable: boolean | null = null;

export function usePlatformWeatherAvailable(): PlatformWeatherAvailableState {
  const [available, setAvailable] = useState(
    () => cachedPlatformWeatherAvailable ?? false,
  );
  const [loading, setLoading] = useState(
    () => cachedPlatformWeatherAvailable === null,
  );

  const load = useCallback(async (silent = false) => {
    const initial = cachedPlatformWeatherAvailable === null;
    if (!silent && initial) {
      setLoading(true);
    }
    try {
      const res = await fetch("/api/weather/status", { cache: "no-store" });
      if (!res.ok) {
        if (initial) {
          cachedPlatformWeatherAvailable = false;
          setAvailable(false);
        }
        return;
      }
      const data = (await res.json()) as { available?: boolean };
      const next = data.available === true;
      cachedPlatformWeatherAvailable = next;
      setAvailable(next);
    } catch {
      if (initial) {
        cachedPlatformWeatherAvailable = false;
        setAvailable(false);
      }
    } finally {
      if (!silent && initial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  useEffect(() => {
    const onFocus = () => void load(true);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  return { available, loading };
}

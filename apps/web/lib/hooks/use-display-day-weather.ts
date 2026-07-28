"use client";

import { useEffect, useRef, useState } from "react";
import { isLocalDayKey } from "@/lib/staff/shift-schedule-range";
import type { ShiftPlanDayWeather } from "@/lib/weather/shift-plan-day-weather-data";

type DisplayDayWeatherResponse =
  | {
      available: true;
      day: string;
      forecast: ShiftPlanDayWeather | null;
    }
  | { available: false };

/**
 * Tages-Wetter für Display-Reservierungen (PIN-Session / Device-Cookies).
 * Nutzt `/api/display/weather?day=YYYY-MM-DD` — nicht den App-Profile-Hook.
 */
export function useDisplayDayWeather(
  dayYmd: string,
  enabled = true,
): {
  weather: ShiftPlanDayWeather | undefined;
  weatherLoading: boolean;
} {
  const [weather, setWeather] = useState<ShiftPlanDayWeather | undefined>();
  const [weatherLoading, setWeatherLoading] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!enabled || !isLocalDayKey(dayYmd)) {
      setWeather(undefined);
      setWeatherLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setWeatherLoading(true);

    void (async () => {
      try {
        const res = await fetch(
          `/api/display/weather?day=${encodeURIComponent(dayYmd)}`,
          { cache: "no-store", credentials: "include" },
        );
        const json = (await res.json()) as DisplayDayWeatherResponse;
        if (requestId !== requestIdRef.current) return;

        if (!res.ok || !json.available || !("forecast" in json) || !json.forecast) {
          setWeather(undefined);
          return;
        }
        setWeather(json.forecast);
      } catch {
        if (requestId !== requestIdRef.current) return;
        setWeather(undefined);
      } finally {
        if (requestId === requestIdRef.current) {
          setWeatherLoading(false);
        }
      }
    })();
  }, [dayYmd, enabled]);

  return { weather, weatherLoading };
}

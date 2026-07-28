import type { WeatherAmbienceKind } from "@/lib/weather/weather-ambience-kind";
import type {
  VisualCrossingDay,
  VisualCrossingTimelineResponse,
} from "@/lib/weather/visual-crossing-types";
import { resolveWeatherAmbienceKind } from "@/lib/weather/weather-ambience-kind";

export type ShiftPlanDayWeather = {
  kind: WeatherAmbienceKind;
  tempMaxC: number;
  tempMinC: number | null;
  precipProb: number | null;
};

function roundTemp(value: number | undefined): number | null {
  if (value == null || Number.isNaN(value)) return null;
  return Math.round(value);
}

function roundPrecip(value: number | undefined): number | null {
  if (value == null || Number.isNaN(value)) return null;
  return Math.round(value);
}

function parseDayForecast(day: VisualCrossingDay): ShiftPlanDayWeather | null {
  const tempMaxC =
    roundTemp(day.tempmax) ??
    roundTemp(day.temp) ??
    roundTemp(day.tempmin);
  if (tempMaxC == null) return null;

  const tempMinRaw = roundTemp(day.tempmin);
  const tempMinC =
    tempMinRaw != null && tempMinRaw !== tempMaxC ? tempMinRaw : null;

  return {
    kind: resolveWeatherAmbienceKind({
      icon: day.icon,
      conditions: day.conditions ?? day.description,
    }),
    tempMaxC,
    tempMinC,
    precipProb: roundPrecip(day.precipprob),
  };
}

export function shiftPlanWeatherTitle(weather: ShiftPlanDayWeather): string {
  const parts = [`Max. ${weather.tempMaxC} °C`];
  if (weather.tempMinC != null) {
    parts.push(`Min. ${weather.tempMinC} °C`);
  }
  if (weather.precipProb != null) {
    parts.push(`Regen ${weather.precipProb} %`);
  }
  return parts.join(" · ");
}

export function parseShiftPlanWeatherByDate(
  data: VisualCrossingTimelineResponse,
): Map<string, ShiftPlanDayWeather> {
  const map = new Map<string, ShiftPlanDayWeather>();
  for (const day of data.days ?? []) {
    const key = day.datetime?.slice(0, 10);
    if (!key) continue;
    const forecast = parseDayForecast(day);
    if (!forecast) continue;
    map.set(key, forecast);
  }
  return map;
}

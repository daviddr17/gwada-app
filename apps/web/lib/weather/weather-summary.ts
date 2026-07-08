import type { VisualCrossingTimelineResponse } from "@/lib/weather/visual-crossing-types";

export type WeatherSummary = {
  temp: number | null;
  precipProb: number | null;
  tempMin: number | null;
  tempMax: number | null;
};

export type DisplayWeatherSnapshot = WeatherSummary & {
  icon?: string;
  conditions?: string;
};

export function weatherSummaryFromTimeline(
  data: VisualCrossingTimelineResponse,
): WeatherSummary {
  const today = data.days?.[0];
  const cur = data.currentConditions;

  return {
    temp: cur?.temp ?? today?.temp ?? null,
    precipProb: today?.precipprob ?? cur?.precipprob ?? null,
    tempMin: today?.tempmin ?? null,
    tempMax: today?.tempmax ?? null,
  };
}

export function displayWeatherFromTimeline(
  data: VisualCrossingTimelineResponse,
): DisplayWeatherSnapshot {
  const today = data.days?.[0];
  const cur = data.currentConditions;

  return {
    ...weatherSummaryFromTimeline(data),
    icon: cur?.icon ?? today?.icon,
    conditions: cur?.conditions ?? today?.conditions,
  };
}

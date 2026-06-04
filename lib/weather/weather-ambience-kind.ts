export type WeatherAmbienceKind =
  | "clear"
  | "night"
  | "cloudy"
  | "rain"
  | "snow"
  | "fog"
  | "storm";

/** Visual-Crossing `icon` / `conditions` → dezenter Widget-Hintergrund. */
export function resolveWeatherAmbienceKind(params: {
  icon?: string;
  conditions?: string;
}): WeatherAmbienceKind {
  const icon = (params.icon ?? "").toLowerCase();
  const text = (params.conditions ?? "").toLowerCase();
  const hay = `${icon} ${text}`;

  if (/thunder|storm|hurricane|tornado/.test(hay)) return "storm";
  if (/snow|ice|sleet|blizzard|flurr/.test(hay)) return "snow";
  if (/rain|drizzle|shower|precip/.test(hay)) return "rain";
  if (/fog|mist|haze|smoke/.test(hay)) return "fog";
  if (/cloud|overcast|partly/.test(hay)) return "cloudy";
  if (/night|moon/.test(hay)) return "night";
  return "clear";
}

import type { RestaurantProfile } from "@/lib/types/restaurant";

/** Visual Crossing erwartet z. B. `Stadt,DE` oder `Stadt,Country`. */
export const DEFAULT_WEATHER_LOCATION = "Frankfurt,DE";

const COUNTRY_ALIASES: Record<string, string> = {
  deutschland: "DE",
  germany: "DE",
  österreich: "AT",
  osterreich: "AT",
  austria: "AT",
  schweiz: "CH",
  switzerland: "CH",
  suisse: "CH",
  france: "FR",
  frankreich: "FR",
  spanien: "ES",
  spain: "ES",
  italien: "IT",
  italy: "IT",
  niederlande: "NL",
  netherlands: "NL",
  belgien: "BE",
  belgium: "BE",
  polen: "PL",
  poland: "PL",
  tschechien: "CZ",
  "czech republic": "CZ",
  "czechia": "CZ",
  luxemburg: "LU",
  luxembourg: "LU",
}

function normalizeCountryToken(raw: string): string {
  const t = raw.trim()
  if (!t) return "DE"
  if (/^[A-Za-z]{2}$/.test(t)) return t.toUpperCase()
  const key = t.toLowerCase()
  return COUNTRY_ALIASES[key] ?? t
}

/**
 * Baut den Timeline-`location`-Pfad für Visual Crossing aus Stammdaten.
 * Ohne Ort → {@link DEFAULT_WEATHER_LOCATION}.
 */
export function buildVisualCrossingLocation(
  profile: Pick<RestaurantProfile, "city" | "country">,
): string {
  const city = profile.city?.trim()
  if (!city) return DEFAULT_WEATHER_LOCATION
  const country = normalizeCountryToken(profile.country?.trim() ?? "")
  return `${city},${country}`
}

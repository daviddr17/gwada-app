/** Standard, wenn keine Adresse hinterlegt ist. */
export const DEFAULT_RESTAURANT_TIMEZONE = "Europe/Berlin";

const COUNTRY_TIMEZONE: Readonly<Record<string, string>> = {
  de: "Europe/Berlin",
  deutschland: "Europe/Berlin",
  germany: "Europe/Berlin",
  at: "Europe/Vienna",
  österreich: "Europe/Vienna",
  oesterreich: "Europe/Vienna",
  austria: "Europe/Vienna",
  ch: "Europe/Zurich",
  schweiz: "Europe/Zurich",
  switzerland: "Europe/Zurich",
  fr: "Europe/Paris",
  frankreich: "Europe/Paris",
  france: "Europe/Paris",
  gp: "America/Guadeloupe",
  guadeloupe: "America/Guadeloupe",
  mq: "America/Martinique",
  martinique: "America/Martinique",
  be: "Europe/Brussels",
  belgien: "Europe/Brussels",
  nl: "Europe/Amsterdam",
  niederlande: "Europe/Amsterdam",
  netherlands: "Europe/Amsterdam",
  lu: "Europe/Luxembourg",
  luxemburg: "Europe/Luxembourg",
  it: "Europe/Rome",
  italien: "Europe/Rome",
  italy: "Europe/Rome",
  es: "Europe/Madrid",
  spanien: "Europe/Madrid",
  spain: "Europe/Madrid",
  pt: "Europe/Lisbon",
  portugal: "Europe/Lisbon",
  pl: "Europe/Warsaw",
  polen: "Europe/Warsaw",
  poland: "Europe/Warsaw",
  cz: "Europe/Prague",
  tschechien: "Europe/Prague",
  dk: "Europe/Copenhagen",
  dänemark: "Europe/Copenhagen",
  daenemark: "Europe/Copenhagen",
  se: "Europe/Stockholm",
  schweden: "Europe/Stockholm",
  no: "Europe/Oslo",
  norwegen: "Europe/Oslo",
  gb: "Europe/London",
  uk: "Europe/London",
  "vereinigtes königreich": "Europe/London",
  ie: "Europe/Dublin",
  irland: "Europe/Dublin",
  us: "America/New_York",
  usa: "America/New_York",
  "vereinigte staaten": "America/New_York",
};

export function hasRestaurantAddress(parts: {
  street?: string | null;
  city?: string | null;
  postalCode?: string | null;
}): boolean {
  return Boolean(
    parts.street?.trim() ||
      parts.city?.trim() ||
      parts.postalCode?.trim(),
  );
}

function normalizeCountryKey(country: string): string {
  return country
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/** Zeitzone aus Land; ohne erkennbares Land → Deutschland. */
export function timezoneFromCountry(country: string | null | undefined): string {
  const key = normalizeCountryKey(country ?? "");
  if (!key) return DEFAULT_RESTAURANT_TIMEZONE;
  return COUNTRY_TIMEZONE[key] ?? DEFAULT_RESTAURANT_TIMEZONE;
}

/** Adresse aus Einstellungen → IANA-Zeitzone; ohne Adresse → `Europe/Berlin`. */
export function resolveRestaurantTimezone(parts: {
  country?: string | null;
  street?: string | null;
  city?: string | null;
  postalCode?: string | null;
}): string {
  if (!hasRestaurantAddress(parts)) {
    return DEFAULT_RESTAURANT_TIMEZONE;
  }
  return timezoneFromCountry(parts.country);
}

const TIMEZONE_LABEL_DE: Readonly<Record<string, string>> = {
  "Europe/Berlin": "Mitteleuropa (Berlin)",
  "Europe/Vienna": "Mitteleuropa (Wien)",
  "Europe/Zurich": "Mitteleuropa (Zürich)",
  "Europe/Paris": "Mitteleuropa (Paris)",
  "Europe/Brussels": "Mitteleuropa (Brüssel)",
  "Europe/Amsterdam": "Mitteleuropa (Amsterdam)",
  "Europe/Rome": "Mitteleuropa (Rom)",
  "Europe/Madrid": "Mitteleuropa (Madrid)",
  "America/Guadeloupe": "Karibik (Guadeloupe)",
  "America/Martinique": "Karibik (Martinique)",
};

export function formatRestaurantTimezoneLabel(tz: string): string {
  return TIMEZONE_LABEL_DE[tz] ?? tz;
}

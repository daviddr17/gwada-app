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

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

export function readRestaurantZonedParts(date: Date, timeZone: string): ZonedParts {
  const dtf = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    dtf
      .formatToParts(date)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

/** UTC-Zeitpunkt für lokale Wanduhr (y-m-d h:m) in `timeZone`. */
export function utcInstantForRestaurantLocal(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  let guess = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  for (let i = 0; i < 4; i++) {
    const z = readRestaurantZonedParts(new Date(guess), timeZone);
    const targetDayNum = Date.UTC(year, month - 1, day) / 86_400_000;
    const actualDayNum = Date.UTC(z.year, z.month - 1, z.day) / 86_400_000;
    const deltaMin =
      (targetDayNum - actualDayNum) * 24 * 60 +
      (hour - z.hour) * 60 +
      (minute - z.minute);
    if (deltaMin === 0) break;
    guess -= deltaMin * 60_000;
  }
  return new Date(guess);
}

export function restaurantZonedDateKey(
  date: Date,
  timeZone: string = DEFAULT_RESTAURANT_TIMEZONE,
): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function isSameRestaurantCalendarDay(
  iso: string,
  ref: Date = new Date(),
  timeZone: string = DEFAULT_RESTAURANT_TIMEZONE,
): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return restaurantZonedDateKey(d, timeZone) === restaurantZonedDateKey(ref, timeZone);
}

export function startOfRestaurantCalendarDay(
  ref: Date = new Date(),
  timeZone: string = DEFAULT_RESTAURANT_TIMEZONE,
): Date {
  const z = readRestaurantZonedParts(ref, timeZone);
  return utcInstantForRestaurantLocal(z.year, z.month, z.day, 0, 0, timeZone);
}

export function restaurantCalendarDaysAgoStart(
  days: number,
  ref: Date = new Date(),
  timeZone: string = DEFAULT_RESTAURANT_TIMEZONE,
): Date {
  const z = readRestaurantZonedParts(ref, timeZone);
  const dayUtc = Date.UTC(z.year, z.month - 1, z.day) - days * 86_400_000;
  const parts = readRestaurantZonedParts(new Date(dayUtc), timeZone);
  return utcInstantForRestaurantLocal(
    parts.year,
    parts.month,
    parts.day,
    0,
    0,
    timeZone,
  );
}

const DEFAULT_DATETIME_OPTIONS: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

export function createRestaurantDateTimeFormatter(
  timeZone: string = DEFAULT_RESTAURANT_TIMEZONE,
  options: Intl.DateTimeFormatOptions = DEFAULT_DATETIME_OPTIONS,
): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("de-DE", { timeZone, ...options });
}

export function formatRestaurantDateTime(
  iso: string | Date | null | undefined,
  timeZone: string = DEFAULT_RESTAURANT_TIMEZONE,
  options: Intl.DateTimeFormatOptions = DEFAULT_DATETIME_OPTIONS,
): string {
  if (!iso) return "—";
  const date = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return "—";
  return createRestaurantDateTimeFormatter(timeZone, options).format(date);
}

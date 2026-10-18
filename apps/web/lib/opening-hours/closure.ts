import { DEFAULT_RESTAURANT_TIMEZONE, restaurantZonedDateKey } from "@/lib/restaurant/restaurant-timezone";

/** Status-Overlay über dem Wochenplan. `open` = der Plan gilt. */
export type OpeningHoursClosureMode = "open" | "temporary" | "permanent";

export type OpeningHoursClosure = {
  mode: OpeningHoursClosureMode;
  /** Inklusiv, `YYYY-MM-DD`, Kalender Europe/Berlin. Nur bei `temporary`. */
  from: string | null;
  /** Inklusiv, `YYYY-MM-DD`, Kalender Europe/Berlin. Nur bei `temporary`. */
  until: string | null;
};

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function defaultOpeningHoursClosure(): OpeningHoursClosure {
  return { mode: "open", from: null, until: null };
}

export function berlinCalendarYmd(now: Date = new Date()): string {
  return restaurantZonedDateKey(now, DEFAULT_RESTAURANT_TIMEZONE);
}

function ymdOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return YMD.test(trimmed) ? trimmed : null;
}

export function parseOpeningHoursClosure(row: {
  closure_mode?: string | null;
  closure_from?: string | null;
  closure_until?: string | null;
} | null | undefined): OpeningHoursClosure {
  const modeRaw = row?.closure_mode?.trim() ?? "open";
  const mode: OpeningHoursClosureMode =
    modeRaw === "temporary" || modeRaw === "permanent" ? modeRaw : "open";
  if (mode !== "temporary") {
    return { mode, from: null, until: null };
  }
  return {
    mode,
    from: ymdOrNull(row?.closure_from),
    until: ymdOrNull(row?.closure_until),
  };
}

export function normalizeOpeningHoursClosure(
  closure: OpeningHoursClosure,
): OpeningHoursClosure {
  if (closure.mode !== "temporary") {
    return { mode: closure.mode, from: null, until: null };
  }
  return {
    mode: "temporary",
    from: ymdOrNull(closure.from),
    until: ymdOrNull(closure.until),
  };
}

export function openingHoursClosuresEqual(
  a: OpeningHoursClosure,
  b: OpeningHoursClosure,
): boolean {
  const left = normalizeOpeningHoursClosure(a);
  const right = normalizeOpeningHoursClosure(b);
  return (
    left.mode === right.mode &&
    left.from === right.from &&
    left.until === right.until
  );
}

export function validateOpeningHoursClosure(
  closure: OpeningHoursClosure,
): string | null {
  const normalized = normalizeOpeningHoursClosure(closure);
  if (normalized.mode !== "temporary") return null;
  const rawFrom = closure.from?.trim() ?? "";
  const rawUntil = closure.until?.trim() ?? "";
  if (rawFrom && !YMD.test(rawFrom)) {
    return "Beginn der Schließung: bitte ein gültiges Datum wählen.";
  }
  if (rawUntil && !YMD.test(rawUntil)) {
    return "Ende der Schließung: bitte ein gültiges Datum wählen.";
  }
  if (normalized.from && normalized.until && normalized.from > normalized.until) {
    return "Der Zeitraum der Schließung: „Von“ liegt nach „Bis“.";
  }
  return null;
}

/**
 * Vorübergehend ohne Datum = sofort und bis zum Umschalten.
 * Mit Datum gilt der inklusive Zeitraum (Europe/Berlin).
 * Dauerhaft ist immer aktiv.
 */
export function isOpeningHoursClosureActiveOnDate(
  closure: OpeningHoursClosure,
  ymd: string,
): boolean {
  const normalized = normalizeOpeningHoursClosure(closure);
  if (normalized.mode === "permanent") return true;
  if (normalized.mode !== "temporary") return false;
  if (normalized.from && ymd < normalized.from) return false;
  if (normalized.until && ymd > normalized.until) return false;
  return true;
}

export function isOpeningHoursClosureActive(
  closure: OpeningHoursClosure,
  todayYmd: string = berlinCalendarYmd(),
): boolean {
  return isOpeningHoursClosureActiveOnDate(closure, todayYmd);
}

/**
 * Google-Sonderzeiten: ein geschlossenes Intervall für den noch laufenden
 * oder künftigen Saisonzeitraum. Ohne Bis-Datum kein Intervall (nur Status).
 */
export function closureSpecialHoursWindow(
  closure: OpeningHoursClosure,
  todayYmd: string,
): { start: string; end: string } | null {
  const normalized = normalizeOpeningHoursClosure(closure);
  if (normalized.mode !== "temporary" || !normalized.until) return null;
  if (normalized.until < todayYmd) return null;
  if (normalized.from && normalized.from > normalized.until) return null;
  const start =
    normalized.from && normalized.from > todayYmd ? normalized.from : todayYmd;
  if (start > normalized.until) return null;
  return { start, end: normalized.until };
}

export function dateInsideClosureWindow(
  ymd: string,
  window: { start: string; end: string } | null,
): boolean {
  if (!window) return false;
  return ymd >= window.start && ymd <= window.end;
}

export type GoogleOpenForBusiness =
  | "OPEN"
  | "CLOSED_TEMPORARILY"
  | "CLOSED_PERMANENTLY";

export function toGoogleOpenInfo(
  closure: OpeningHoursClosure,
  todayYmd: string,
): { status: GoogleOpenForBusiness; canReopen?: boolean } {
  const normalized = normalizeOpeningHoursClosure(closure);
  if (normalized.mode === "permanent") {
    return { status: "CLOSED_PERMANENTLY", canReopen: false };
  }
  if (
    normalized.mode === "temporary" &&
    isOpeningHoursClosureActive(normalized, todayYmd)
  ) {
    return { status: "CLOSED_TEMPORARILY", canReopen: true };
  }
  return { status: "OPEN" };
}

/** Meta Page: `temporary_status` ist lowercase, `is_permanently_closed` bool. */
export function toFacebookClosureFields(
  closure: OpeningHoursClosure,
  todayYmd: string,
): {
  is_permanently_closed: boolean;
  temporary_status?: "temporarily_closed" | "operating_as_usual";
} {
  const normalized = normalizeOpeningHoursClosure(closure);
  if (normalized.mode === "permanent") {
    return { is_permanently_closed: true };
  }
  if (
    normalized.mode === "temporary" &&
    isOpeningHoursClosureActive(normalized, todayYmd)
  ) {
    return {
      is_permanently_closed: false,
      temporary_status: "temporarily_closed",
    };
  }
  return {
    is_permanently_closed: false,
    temporary_status: "operating_as_usual",
  };
}

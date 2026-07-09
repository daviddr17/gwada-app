/** Ergebnis der Sprach-/Text-Parsing für Reservierungs-FAB (Modul Reservierungen). */

export type ParsedReservationVoice = {
  guestFirstName: string;
  guestLastName: string;
  partySize: number;
  /** yyyy-MM-dd */
  dateYmd: string;
  /** HH:mm */
  timeHm: string;
  rawName: string;
};

export type ParseReservationVoiceResult =
  | { ok: true; parsed: ParsedReservationVoice }
  | { ok: false; error: string };

const WORD_NUM: Record<string, number> = {
  eins: 1,
  eine: 1,
  ein: 1,
  zwei: 2,
  zwo: 2,
  drei: 3,
  vier: 4,
  fünf: 5,
  fuenf: 5,
  sechs: 6,
  sieben: 7,
  acht: 8,
  neun: 9,
  zehn: 10,
  elf: 11,
  zwölf: 12,
  zwoelf: 12,
};

const MONTH_NAMES: Record<string, number> = {
  januar: 1,
  jan: 1,
  februar: 2,
  feb: 2,
  märz: 3,
  maerz: 3,
  mär: 3,
  mar: 3,
  april: 4,
  apr: 4,
  mai: 5,
  juni: 6,
  jun: 6,
  juli: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  oktober: 10,
  okt: 10,
  november: 11,
  nov: 11,
  dezember: 12,
  dez: 12,
};

const MONTH_NAME_PATTERN = Object.keys(MONTH_NAMES)
  .sort((a, b) => b.length - a.length)
  .join("|");

function normalizeText(input: string): string {
  return input
    .replace(/\s+/g, " ")
    .replace(/[,;]/g, " ")
    .trim();
}

/** STT-typische Abweichungen vor dem Parsing glätten. */
function normalizeSpokenReservationText(input: string): string {
  let text = normalizeText(input).toLowerCase();
  text = text
    .replace(/\bpersoen?\b/g, "personen")
    .replace(/\bperson\b/g, "personen")
    .replace(/\bleute\b/g, "personen")
    .replace(/\bpax\b/g, "personen")
    .replace(/\buhr(e|en)?\b/g, "uhr")
    .replace(/\bpunkt\b/g, " ")
    .replace(/\bkomma\b/g, " ")
    .replace(/\bund\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text;
}

function stripPrefixes(text: string): string {
  return text
    .replace(
      /^(neue\s+)?reservierung(\s+für|\s+von|\s+)?/i,
      "",
    )
    .replace(/^für\s+/i, "")
    .trim();
}

function parsePartySize(text: string): { size: number; rest: string } | null {
  const wordAlt = Object.keys(WORD_NUM).join("|");
  const patterns = [
    new RegExp(
      `(\\d+|${wordAlt})\\s*(personen|pers\\.?|gäste?|gast|p\\.?)\\b`,
      "i",
    ),
    new RegExp(`\\bfür\\s+(\\d+|${wordAlt})\\b`, "i"),
    new RegExp(`\\bmit\\s+(\\d+|${wordAlt})\\b`, "i"),
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    const raw = m[1]!.toLowerCase();
    const size =
      /^\d+$/.test(raw) ? Number.parseInt(raw, 10) : (WORD_NUM[raw] ?? NaN);
    if (!Number.isFinite(size) || size < 1 || size > 50) continue;
    const rest = (text.slice(0, m.index!) + text.slice(m.index! + m[0].length))
      .replace(/\s+/g, " ")
      .trim();
    return { size, rest };
  }

  return null;
}

function resolveYear(
  yearPart: string | undefined,
  ref: Date,
  month: number,
  day: number,
): number | null {
  if (yearPart != null && yearPart !== "") {
    const year =
      yearPart.length === 2
        ? 2000 + Number.parseInt(yearPart, 10)
        : Number.parseInt(yearPart, 10);
    return isValidYmd(year, month, day) ? year : null;
  }
  // Kein Jahr genannt → immer aktuelles Kalenderjahr (Referenzdatum).
  const year = ref.getFullYear();
  return isValidYmd(year, month, day) ? year : null;
}

function dateMatchToYmd(
  text: string,
  match: RegExpMatchArray,
  ref: Date,
  day: number,
  month: number,
  yearPart?: string,
): { ymd: string; rest: string } | null {
  const year = resolveYear(yearPart, ref, month, day);
  if (year == null) return null;
  const ymd = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const rest = (
    text.slice(0, match.index!) + text.slice(match.index! + match[0].length)
  )
    .replace(/\s+/g, " ")
    .trim();
  return { ymd, rest };
}

function parseDateYmd(
  text: string,
  ref: Date,
): { ymd: string; rest: string } | null {
  const relative = text.match(/\b(heute|morgen|übermorgen|uebermorgen)\b/i);
  if (relative) {
    const word = relative[1]!.toLowerCase();
    const day = new Date(ref);
    if (word === "morgen") day.setDate(day.getDate() + 1);
    if (word === "übermorgen" || word === "uebermorgen") {
      day.setDate(day.getDate() + 2);
    }
    const ymd = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    const rest = (
      text.slice(0, relative.index!) +
      text.slice(relative.index! + relative[0].length)
    )
      .replace(/\s+/g, " ")
      .trim();
    return { ymd, rest };
  }

  const dotted = text.match(
    /\b(\d{1,2})[\./\-](\d{1,2})(?:[\./\-](\d{2,4}))?\b/,
  );
  if (dotted) {
    return dateMatchToYmd(
      text,
      dotted,
      ref,
      Number.parseInt(dotted[1]!, 10),
      Number.parseInt(dotted[2]!, 10),
      dotted[3],
    );
  }

  const spacedWithYear = text.match(
    /\b(\d{1,2})\s+(\d{1,2})\s+(\d{4})\b/,
  );
  if (spacedWithYear) {
    return dateMatchToYmd(
      text,
      spacedWithYear,
      ref,
      Number.parseInt(spacedWithYear[1]!, 10),
      Number.parseInt(spacedWithYear[2]!, 10),
      spacedWithYear[3],
    );
  }

  const spaced = text.match(/\b(\d{1,2})\s+(\d{1,2})\b/);
  if (spaced) {
    const day = Number.parseInt(spaced[1]!, 10);
    const month = Number.parseInt(spaced[2]!, 10);
    if (month >= 1 && month <= 12) {
      return dateMatchToYmd(text, spaced, ref, day, month);
    }
  }

  const namedMonth = text.match(
    new RegExp(`\\b(\\d{1,2})\\.?\\s*(${MONTH_NAME_PATTERN})\\b`, "i"),
  );
  if (namedMonth) {
    const month = MONTH_NAMES[namedMonth[2]!.toLowerCase()];
    if (month) {
      return dateMatchToYmd(
        text,
        namedMonth,
        ref,
        Number.parseInt(namedMonth[1]!, 10),
        month,
      );
    }
  }

  return null;
}

function parseTimeHm(text: string): { hm: string; rest: string } | null {
  const wordAlt = Object.keys(WORD_NUM).join("|");
  const umClock = text.match(
    /\b(?:um\s+)?(\d{1,2})[:.](\d{2})\s*(?:uhr)?\b/i,
  );
  if (umClock) {
    const h = Number.parseInt(umClock[1]!, 10);
    const mi = Number.parseInt(umClock[2]!, 10);
    if (h < 0 || h > 23 || mi < 0 || mi > 59) return null;
    const hm = `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
    const rest = (
      text.slice(0, umClock.index!) +
      text.slice(umClock.index! + umClock[0].length)
    )
      .replace(/\s+/g, " ")
      .trim();
    return { hm, rest };
  }

  const spacedClock = text.match(
    /\b(?:um\s+)?(\d{1,2})\s+(\d{2})\s*(?:uhr)?\b/i,
  );
  if (spacedClock) {
    const h = Number.parseInt(spacedClock[1]!, 10);
    const mi = Number.parseInt(spacedClock[2]!, 10);
    if (h >= 0 && h <= 23 && mi >= 0 && mi <= 59) {
      const hm = `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
      const rest = (
        text.slice(0, spacedClock.index!) +
        text.slice(spacedClock.index! + spacedClock[0].length)
      )
        .replace(/\s+/g, " ")
        .trim();
      return { hm, rest };
    }
  }

  const hourOnly = text.match(
    new RegExp(`\\b(?:um\\s+)?(\\d{1,2}|${wordAlt})\\s*uhr\\b`, "i"),
  );
  if (hourOnly) {
    const raw = hourOnly[1]!.toLowerCase();
    const h = /^\d+$/.test(raw)
      ? Number.parseInt(raw, 10)
      : (WORD_NUM[raw] ?? NaN);
    if (!Number.isFinite(h) || h < 0 || h > 23) return null;
    const hm = `${String(h).padStart(2, "0")}:00`;
    const rest = (
      text.slice(0, hourOnly.index!) +
      text.slice(hourOnly.index! + hourOnly[0].length)
    )
      .replace(/\s+/g, " ")
      .trim();
    return { hm, rest };
  }

  return null;
}

function isValidYmd(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return (
    dt.getFullYear() === y &&
    dt.getMonth() === m - 1 &&
    dt.getDate() === d
  );
}

function splitGuestName(raw: string): {
  guestFirstName: string;
  guestLastName: string;
  rawName: string;
} {
  const name = raw.replace(/\b(am|on)\b/gi, " ").replace(/\s+/g, " ").trim();
  if (!name) {
    return { guestFirstName: "", guestLastName: "", rawName: "" };
  }
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return {
      guestFirstName: parts[0]!,
      guestLastName: "",
      rawName: name,
    };
  }
  return {
    guestFirstName: parts[0]!,
    guestLastName: parts.slice(1).join(" "),
    rawName: name,
  };
}

export function parseReservationVoiceText(
  input: string,
  options?: { referenceDate?: Date },
): ParseReservationVoiceResult {
  const ref = options?.referenceDate ?? new Date();
  let text = stripPrefixes(normalizeText(input));
  if (!text) {
    return {
      ok: false,
      error: "Kein Text erkannt. Bitte Name, Personen, Datum und Uhrzeit nennen.",
    };
  }

  const party = parsePartySize(text);
  if (!party) {
    return {
      ok: false,
      error: "Personenzahl fehlt (z. B. „3 Personen“ oder „für 3“).",
    };
  }
  text = party.rest;

  const date = parseDateYmd(text, ref);
  if (!date) {
    return {
      ok: false,
      error:
        "Datum fehlt (z. B. „heute“, „18.7.“, „18. Juli“ — Jahr optional, sonst aktuelles Jahr).",
    };
  }
  text = date.rest;

  const time = parseTimeHm(text);
  if (!time) {
    return {
      ok: false,
      error: "Uhrzeit fehlt (z. B. „19 Uhr“, „19:00“ oder „19 30“).",
    };
  }
  text = time.rest;

  const { guestFirstName, guestLastName, rawName } = splitGuestName(text);

  return {
    ok: true,
    parsed: {
      guestFirstName,
      guestLastName,
      partySize: party.size,
      dateYmd: date.ymd,
      timeHm: time.hm,
      rawName,
    },
  };
}

/** Primärtranskript + STT-Alternativen und gesprochene Varianten ausprobieren. */
export function parseReservationVoiceTextWithAlternatives(
  primary: string,
  alternatives: string[] = [],
  options?: { referenceDate?: Date },
): ParseReservationVoiceResult {
  const tried = new Set<string>();
  const candidates = [primary, ...alternatives];

  for (const raw of candidates) {
    const text = normalizeText(raw);
    if (!text || tried.has(text)) continue;
    tried.add(text);
    const result = parseReservationVoiceText(text, options);
    if (result.ok) return result;
  }

  for (const raw of candidates) {
    const text = normalizeSpokenReservationText(raw);
    if (!text || tried.has(text)) continue;
    tried.add(text);
    const result = parseReservationVoiceText(text, options);
    if (result.ok) return result;
  }

  return parseReservationVoiceText(primary, options);
}

export function formatParsedReservationVoiceLabel(
  parsed: ParsedReservationVoice,
): string {
  const name = [parsed.guestFirstName, parsed.guestLastName]
    .filter(Boolean)
    .join(" ");
  const dateLabel = new Date(`${parsed.dateYmd}T12:00:00`).toLocaleDateString(
    "de-DE",
    { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" },
  );
  return `${name} · ${parsed.partySize} Pers. · ${dateLabel} · ${parsed.timeHm} Uhr`;
}

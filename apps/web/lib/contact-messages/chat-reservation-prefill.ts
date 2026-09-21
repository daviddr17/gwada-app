/**
 * Personen / Uhrzeit / Datum aus der letzten Gastnachricht — nur klare Treffer,
 * keine Spekulation (kein „für 4“ ohne Personenwort).
 */

import { parseDateYmd, parseTimeHm } from "@/lib/reservations/parse-reservation-voice-text";
import { isValidStaffPartySize } from "@/lib/reservations/reservation-party-size";

export type ChatReservationPrefillHints = {
  partySize: number | null;
  timeHm: string | null;
  /** Nur wenn im Text genannt (heute/morgen/Datum/Wochentag). */
  dateYmd: string | null;
};

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

const ZU_COUNT: Record<string, number> = {
  zweit: 2,
  dritt: 3,
  viert: 4,
  fünft: 5,
  fuenft: 5,
  sechst: 6,
  siebt: 7,
  acht: 8,
  neunt: 9,
  zehnt: 10,
};

const WEEKDAY_INDEX: Record<string, number> = {
  sonntag: 0,
  montag: 1,
  dienstag: 2,
  mittwoch: 3,
  donnerstag: 4,
  freitag: 5,
  samstag: 6,
};

function parseCountToken(raw: string): number | null {
  const token = raw.toLowerCase();
  const size = /^\d+$/.test(token)
    ? Number.parseInt(token, 10)
    : (WORD_NUM[token] ?? NaN);
  return isValidStaffPartySize(size) ? size : null;
}

function guestMessagePlainText(body: string): string {
  const withoutHtml = body.replace(/<[^>]+>/g, " ");
  const withoutQuote = withoutHtml.split(
    /\n(?:>|\s*Am\s+\d|\s*Von:)/i,
  )[0] ?? withoutHtml;
  return withoutQuote.replace(/\s+/g, " ").trim();
}

function parsePartySizeExplicit(text: string): number | null {
  const wordAlt = Object.keys(WORD_NUM).join("|");
  const zuAlt = Object.keys(ZU_COUNT).join("|");
  const patterns = [
    new RegExp(
      `(\\d+|${wordAlt})\\s*(personen|pers\\.?|leute|gäste?|gast|pax)\\b`,
      "i",
    ),
    new RegExp(
      `\\bwir\\s+(?:sind|wären|waeren|kommen|kommen\\s+zu)\\s+(\\d+|${wordAlt})\\b`,
      "i",
    ),
    new RegExp(`\\bzu\\s+(${zuAlt})\\b`, "i"),
  ];

  for (const [index, re] of patterns.entries()) {
    const match = text.match(re);
    if (!match) continue;
    if (index === 2) {
      const size = ZU_COUNT[match[1]!.toLowerCase()];
      return size && isValidStaffPartySize(size) ? size : null;
    }
    const size = parseCountToken(match[1]!);
    if (size != null) return size;
  }
  return null;
}

function ymdFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseWeekdayYmd(text: string, ref: Date): string | null {
  const match = text.match(
    /\b(nächste[nr]?s?\s+)?(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b/i,
  );
  if (!match) return null;
  const weekday = WEEKDAY_INDEX[match[2]!.toLowerCase()];
  if (weekday == null) return null;
  const forceNext = Boolean(match[1]);
  const day = new Date(ref);
  const add = (weekday - day.getDay() + 7) % 7;
  day.setDate(day.getDate() + (add === 0 && forceNext ? 7 : add));
  return ymdFromDate(day);
}

export function parseReservationHintsFromGuestMessage(
  body: string,
  options?: { referenceDate?: Date },
): ChatReservationPrefillHints {
  const ref = options?.referenceDate ?? new Date();
  const text = guestMessagePlainText(body);
  if (!text) {
    return { partySize: null, timeHm: null, dateYmd: null };
  }

  const date = parseDateYmd(text, ref);
  const weekdayYmd = date ? null : parseWeekdayYmd(text, ref);
  const time = parseTimeHm(text);

  return {
    partySize: parsePartySizeExplicit(text),
    timeHm: time?.hm ?? null,
    dateYmd: date?.ymd ?? weekdayYmd,
  };
}

export function reservationHintsFromLastGuestMessage(
  messages: ReadonlyArray<{
    direction: string;
    body?: string | null;
    created_at: string;
  }>,
  options?: { referenceDate?: Date },
): ChatReservationPrefillHints {
  const lastInbound = [...messages]
    .filter((row) => row.direction === "inbound" && row.body?.trim())
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )[0];
  if (!lastInbound?.body) {
    return { partySize: null, timeHm: null, dateYmd: null };
  }
  return parseReservationHintsFromGuestMessage(lastInbound.body, options);
}

export function localDateFromYmd(ymd: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(year!, month! - 1, day!);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month! - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

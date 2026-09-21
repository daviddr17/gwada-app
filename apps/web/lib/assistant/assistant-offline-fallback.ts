import "server-only";

import {
  DEFAULT_APP_LOCALE,
  normalizeAppLocale,
  type AppLocale,
} from "@/i18n/config";
import {
  toolCountReservations,
  toolGetRestaurantRules,
  toolSearchHandbook,
  type AssistantToolContext,
} from "@/lib/assistant/assistant-tools";
import { weekdayLabelForLocale } from "@/lib/assistant/assistant-weekday-label";
import { addDays, startOfWeekMonday } from "@/lib/staff/shift-schedule-range";

export const ASSISTANT_API_KEY_HINT =
  "Mehr Funktionen (freie Dialoge, Reservierungen anlegen, komplexere Fragen) mit API-Key unter Superadmin → Integrationen → Assistent (OpenAI / Grok).";

function ymdInTz(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function partsInTz(
  date: Date,
  timeZone: string,
): { y: number; m: number; d: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "0";
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    y: Number(get("year")),
    m: Number(get("month")),
    d: Number(get("day")),
    weekday: weekdayMap[get("weekday")] ?? 0,
  };
}

/** UTC noon anchor for a YMD in the restaurant timezone (good enough for ranges). */
function dateFromYmd(ymd: string): Date {
  return new Date(`${ymd}T12:00:00Z`);
}

export function resolveOfflineDateRange(
  text: string,
  timeZone: string,
): { start_ymd: string; end_ymd: string; label: string } | null {
  const t = text.toLowerCase();
  const now = new Date();
  const todayYmd = ymdInTz(now, timeZone);
  const today = dateFromYmd(todayYmd);
  const { weekday } = partsInTz(now, timeZone);

  if (/\bheute\b/.test(t)) {
    return { start_ymd: todayYmd, end_ymd: todayYmd, label: "heute" };
  }
  if (/\bmorgen\b/.test(t)) {
    const ymd = ymdInTz(addDays(today, 1), timeZone);
    return { start_ymd: ymd, end_ymd: ymd, label: "morgen" };
  }
  if (/übermorgen|uebermorgen/.test(t)) {
    const ymd = ymdInTz(addDays(today, 2), timeZone);
    return { start_ymd: ymd, end_ymd: ymd, label: "übermorgen" };
  }
  if (/nächste\s+woche|naechste\s+woche|kommende\s+woche/.test(t)) {
    const thisMonday = startOfWeekMonday(today);
    const nextMonday = addDays(thisMonday, 7);
    const nextSunday = addDays(nextMonday, 6);
    return {
      start_ymd: ymdInTz(nextMonday, timeZone),
      end_ymd: ymdInTz(nextSunday, timeZone),
      label: "nächste Woche",
    };
  }
  if (/diese\s+woche|aktuellen?\s+woche/.test(t)) {
    const monday = startOfWeekMonday(today);
    const sunday = addDays(monday, 6);
    return {
      start_ymd: ymdInTz(monday, timeZone),
      end_ymd: ymdInTz(sunday, timeZone),
      label: "diese Woche",
    };
  }
  if (/dieses\s+monat|diesen\s+monat|aktuellen?\s+monat/.test(t)) {
    const p = partsInTz(now, timeZone);
    const start = `${p.y}-${String(p.m).padStart(2, "0")}-01`;
    const lastDay = new Date(Date.UTC(p.y, p.m, 0)).getUTCDate();
    const end = `${p.y}-${String(p.m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return { start_ymd: start, end_ymd: end, label: "diesen Monat" };
  }
  if (/nächsten?\s+monat|naechsten?\s+monat/.test(t)) {
    const p = partsInTz(now, timeZone);
    let y = p.y;
    let m = p.m + 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    const start = `${y}-${String(m).padStart(2, "0")}-01`;
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const end = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return { start_ymd: start, end_ymd: end, label: "nächsten Monat" };
  }
  if (/wochenende/.test(t)) {
    // Nächstes/dieses Wochenende: Sa–So relativ zu heute (Restaurant-TZ-Wochentag)
    let daysUntilSat = (6 - weekday + 7) % 7;
    if (weekday === 0) {
      // Sonntag → aktuelles Wochenende (Sa–So)
      const sat = addDays(today, -1);
      return {
        start_ymd: ymdInTz(sat, timeZone),
        end_ymd: todayYmd,
        label: "dieses Wochenende",
      };
    }
    if (weekday === 6) daysUntilSat = 0;
    const sat = addDays(today, daysUntilSat);
    const sun = addDays(sat, 1);
    return {
      start_ymd: ymdInTz(sat, timeZone),
      end_ymd: ymdInTz(sun, timeZone),
      label: daysUntilSat === 0 ? "dieses Wochenende" : "Wochenende",
    };
  }

  return null;
}

function wantsReservationStats(text: string): boolean {
  const t = text.toLowerCase();
  const aboutReservations = /reservier|buchung|gäste|gaeste|tisch/.test(t);
  const countish =
    /wie\s+viele|wieviele|anzahl|zähl|zaehl|gibt\s+es|haben\s+wir|geplant|statistik/.test(
      t,
    );
  return aboutReservations && countish;
}

function wantsRules(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /öffnungszeit|oeffnungszeit|wann\s+(habt|sind|öffnet|geoeffnet|geöffnet)|geschlossen|küchenzeit|kuechenzeit|sonderöff|sonderoeff|feiertag/.test(
      t,
    ) && !/wie\s+lege|wie\s+stell|handbuch|hilfe|erklä|erklae/.test(t)
  );
}

function wantsHandbook(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /wie\s+(lege|stell|mache|funktioniert|geht|kann)|handbuch|hilfe|erklä|erklae|anleitung|wo\s+finde|tutorial/.test(
      t,
    ) ||
    /sonderöffnungszeit|sonderoeffnungszeit|speisekarte|schichtplan|bestand|mitarbeiter|bewertung|einbett/.test(
      t,
    )
  );
}

function wantsCreateReservation(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /(leg|erstell|anleg|buch).{0,24}(reservier|tisch)/.test(t) ||
    /neue\s+reservier|reservier.{0,12}(anlegen|erstellen)/.test(t)
  );
}

function wantsHelp(text: string): boolean {
  const t = text.toLowerCase().trim();
  return (
    t.length < 24 &&
    /^(hi|hallo|hey|hilfe|help|was\s+kannst|was\s+geht|\?+)$/.test(t)
  );
}

function appendApiKeyHint(body: string): string {
  return `${body.trim()}\n\n—\n${ASSISTANT_API_KEY_HINT}`;
}

function formatHandbookReply(raw: string): string {
  let parsed: {
    ok?: boolean;
    matches?: Array<{
      title: string;
      description: string;
      href: string;
      intro?: string[];
      sections?: Array<{ heading: string; body?: string | null }>;
    }>;
    hint?: string;
    error?: string;
  };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    return "Handbuch konnte nicht gelesen werden.";
  }
  if (!parsed.ok) return parsed.error ?? "Handbuch-Suche fehlgeschlagen.";
  if (!parsed.matches?.length) {
    return (
      parsed.hint ??
      "Dazu habe ich im Handbuch nichts gefunden. Formuliere z. B. „Wie lege ich Sonderöffnungszeiten an?“."
    );
  }
  const lines: string[] = ["Aus dem Handbuch:"];
  for (const m of parsed.matches) {
    lines.push(`\n• ${m.title}`);
    if (m.description) lines.push(`  ${m.description}`);
    if (m.intro?.[0]) lines.push(`  ${m.intro[0]}`);
    if (m.sections?.[0]?.heading) {
      lines.push(`  Abschnitt: ${m.sections[0].heading}`);
    }
    lines.push(`  → ${m.href}`);
  }
  return lines.join("\n");
}

function formatRulesReply(raw: string, locale: AppLocale): string {
  let parsed: {
    ok?: boolean;
    error?: string;
    restaurant_name?: string | null;
    time_zone?: string;
    weekly_hours?: Array<{
      weekday: string | null;
      weekday_label?: string | null;
      closed: boolean;
      opens_at: string | null;
      closes_at: string | null;
    }>;
    upcoming_exceptions?: Array<{
      date: string | null;
      closed: boolean;
      opens_at: string | null;
      closes_at: string | null;
      note: string | null;
    }>;
    reservation_settings?: {
      default_dwell_minutes?: number;
      booking_lead_time_hours?: number | null;
    } | null;
  };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    return "Regeln konnten nicht geladen werden.";
  }
  if (!parsed.ok) return parsed.error ?? "Regeln nicht verfügbar.";

  const lines: string[] = [
    parsed.restaurant_name
      ? `Regeln für ${parsed.restaurant_name}:`
      : "Restaurant-Regeln:",
  ];
  if (parsed.weekly_hours?.length) {
    lines.push("\nWochenplan:");
    for (const h of parsed.weekly_hours) {
      const day =
        h.weekday_label?.trim() ||
        weekdayLabelForLocale(h.weekday, locale, "short");
      if (h.closed) {
        lines.push(`• ${day}: geschlossen`);
      } else {
        const open = String(h.opens_at ?? "").slice(0, 5);
        const close = String(h.closes_at ?? "").slice(0, 5);
        lines.push(`• ${day}: ${open}–${close}`);
      }
    }
  }
  if (parsed.upcoming_exceptions?.length) {
    lines.push("\nSonderregeln (Auszug):");
    for (const ex of parsed.upcoming_exceptions.slice(0, 8)) {
      const date = ex.date ?? "?";
      if (ex.closed) {
        lines.push(`• ${date}: geschlossen${ex.note ? ` (${ex.note})` : ""}`);
      } else {
        lines.push(
          `• ${date}: ${String(ex.opens_at ?? "").slice(0, 5)}–${String(ex.closes_at ?? "").slice(0, 5)}${ex.note ? ` (${ex.note})` : ""}`,
        );
      }
    }
  }
  if (parsed.reservation_settings) {
    const s = parsed.reservation_settings;
    lines.push("\nReservierungen:");
    if (s.default_dwell_minutes != null) {
      lines.push(`• Standard-Aufenthalt: ${s.default_dwell_minutes} Min.`);
    }
    if (s.booking_lead_time_hours != null) {
      lines.push(`• Vorlauf: ${s.booking_lead_time_hours} Std.`);
    }
  }
  return lines.join("\n");
}

function formatStatsReply(
  raw: string,
  label: string,
): string {
  let parsed: {
    ok?: boolean;
    error?: string;
    reservation_count?: number;
    guest_count?: number;
    start_ymd?: string;
    end_ymd?: string;
  };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    return "Statistik konnte nicht geladen werden.";
  }
  if (!parsed.ok) return parsed.error ?? "Keine Statistik verfügbar.";
  const range =
    parsed.start_ymd && parsed.end_ymd
      ? parsed.start_ymd === parsed.end_ymd
        ? parsed.start_ymd
        : `${parsed.start_ymd} bis ${parsed.end_ymd}`
      : label;
  return [
    `Reservierungen ${label} (${range}):`,
    `• ${parsed.reservation_count ?? 0} Reservierung(en)`,
    `• ${parsed.guest_count ?? 0} Gast/Gäste`,
  ].join("\n");
}

/**
 * Deterministischer Assistent ohne LLM: Stats, Handbuch, Öffnungszeiten/Regeln.
 * Immer mit Hinweis auf API-Key für erweiterte Funktionen.
 */
export async function runAssistantOfflineFallback(input: {
  ctx: AssistantToolContext;
  userMessage: string;
  timeZone: string;
  restaurantName: string | null;
  locale?: AppLocale | string | null;
}): Promise<string> {
  const locale = normalizeAppLocale(input.locale ?? DEFAULT_APP_LOCALE);
  const msg = input.userMessage.trim();
  if (!msg) {
    return appendApiKeyHint("Schreib mir eine kurze Frage.");
  }

  if (wantsHelp(msg)) {
    return appendApiKeyHint(
      [
        `Hallo${input.restaurantName ? ` — ${input.restaurantName}` : ""}! Offline kann ich u. a.:`,
        "• Reservierungszahlen (heute / nächste Woche / …)",
        "• Öffnungszeiten & Regeln erklären",
        "• Handbuch-Hilfe (z. B. Sonderöffnungszeiten)",
        "",
        "Beispiele:",
        "„Wie viele Reservierungen nächste Woche?“",
        "„Wann haben wir geöffnet?“",
        "„Wie lege ich Sonderöffnungszeiten an?“",
      ].join("\n"),
    );
  }

  if (wantsCreateReservation(msg)) {
    return appendApiKeyHint(
      "Reservierungen anlegen geht im Offline-Modus nicht zuverlässig (fehlende Felder, Bestätigung). Mit API-Key kann ich das im Chat durchführen — oder du nutzt Reservierungen → Neu.",
    );
  }

  if (wantsReservationStats(msg)) {
    const range =
      resolveOfflineDateRange(msg, input.timeZone) ??
      resolveOfflineDateRange("heute", input.timeZone)!;
    const raw = await toolCountReservations(input.ctx, {
      start_ymd: range.start_ymd,
      end_ymd: range.end_ymd,
    });
    return appendApiKeyHint(formatStatsReply(raw, range.label));
  }

  if (wantsRules(msg)) {
    const raw = await toolGetRestaurantRules(input.ctx, { locale });
    return appendApiKeyHint(formatRulesReply(raw, locale));
  }

  if (wantsHandbook(msg)) {
    const raw = await toolSearchHandbook(input.ctx, { query: msg });
    return appendApiKeyHint(formatHandbookReply(raw));
  }

  // Soft fallback: try handbook, then help text
  const handbook = await toolSearchHandbook(input.ctx, { query: msg });
  let parsed: { ok?: boolean; matches?: unknown[] } = {};
  try {
    parsed = JSON.parse(handbook) as typeof parsed;
  } catch {
    parsed = {};
  }
  if (parsed.ok && Array.isArray(parsed.matches) && parsed.matches.length > 0) {
    return appendApiKeyHint(formatHandbookReply(handbook));
  }

  return appendApiKeyHint(
    [
      "Das habe ich offline nicht eindeutig erkannt.",
      "Probier z. B.:",
      "• „Wie viele Reservierungen nächste Woche?“",
      "• „Öffnungszeiten“",
      "• „Wie funktioniert der Bestand?“",
    ].join("\n"),
  );
}

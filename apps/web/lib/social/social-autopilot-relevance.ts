/**
 * Pure relevance helpers for News Autopilot generation.
 * Keeps holiday/seasonal posts near "now" and prioritizes restaurant media.
 */

/** Feiertage nur, wenn sie in den nächsten N Tagen liegen (inkl. heute). */
export const SOCIAL_AUTOPILOT_HOLIDAY_LOOKAHEAD_DAYS = 5;

/** Max. ein Feiertags-Slot pro Generierung — Rest geht an Speisekarte/Galerie/Events. */
export const SOCIAL_AUTOPILOT_MAX_HOLIDAY_SLOTS = 1;

export type AutopilotHolidayCandidate = {
  date: string; // YYYY-MM-DD
  name: string;
};

function parseYmd(ymd: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const d = new Date(`${ymd}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysBetweenLocal(from: Date, to: Date): number {
  const a = startOfLocalDay(from).getTime();
  const b = startOfLocalDay(to).getTime();
  return Math.round((b - a) / 86_400_000);
}

/**
 * Nur Feiertage, die bald anstehen — nicht „Maria Himmelfahrt in 2 Wochen“
 * als generischer Wochenfüller.
 */
export function filterRelevantHolidays(
  holidays: AutopilotHolidayCandidate[],
  opts?: { now?: Date; lookaheadDays?: number; maxSlots?: number },
): AutopilotHolidayCandidate[] {
  const now = opts?.now ?? new Date();
  const lookahead =
    opts?.lookaheadDays ?? SOCIAL_AUTOPILOT_HOLIDAY_LOOKAHEAD_DAYS;
  const maxSlots = opts?.maxSlots ?? SOCIAL_AUTOPILOT_MAX_HOLIDAY_SLOTS;

  const relevant = holidays
    .filter((h) => {
      const day = parseYmd(h.date);
      if (!day) return false;
      const delta = daysBetweenLocal(now, day);
      return delta >= 0 && delta <= lookahead;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  return relevant.slice(0, Math.max(0, maxSlots));
}

/**
 * Events nur wenn Start in den nächsten N Tagen (oder heute) — nicht monatelang voraus.
 */
export function isEventRelevantSoon(
  startAtIso: string,
  opts?: { now?: Date; lookaheadDays?: number },
): boolean {
  const now = opts?.now ?? new Date();
  const lookahead = opts?.lookaheadDays ?? 14;
  const start = new Date(startAtIso);
  if (Number.isNaN(start.getTime())) return false;
  const delta = daysBetweenLocal(now, start);
  return delta >= -1 && delta <= lookahead;
}

/**
 * Deterministische Rotation: bei jedem Force-Refresh andere Gerichte/Galerie zuerst,
 * damit „Neu vorschlagen“ nicht dieselbe Reihenfolge produziert.
 */
export function rotateBySeed<T>(items: T[], seed: string): T[] {
  if (items.length <= 1) return [...items];
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const offset = (h >>> 0) % items.length;
  if (offset === 0) return [...items];
  return [...items.slice(offset), ...items.slice(0, offset)];
}

export type AutopilotContentReason =
  | { kind: "holiday"; label: string; detail: string }
  | { kind: "event"; label: string; detail: string }
  | { kind: "menu_dish"; label: string; detail: string }
  | { kind: "ambient"; label: string; detail: string }
  | { kind: "brand"; label: string; detail: string };

/** Kurztext für die Autopilot-Karte: warum dieser Vorschlag existiert. */
export function contentReasonFromSuggestion(params: {
  slotKind: string;
  title: string | null;
  assetLabel?: string | null;
  source: Record<string, unknown>;
}): AutopilotContentReason {
  const { slotKind, title, assetLabel, source } = params;
  if (slotKind === "holiday") {
    const name =
      (typeof source.holidayName === "string" && source.holidayName) ||
      title ||
      "Feiertag";
    const date = typeof source.date === "string" ? source.date : "";
    return {
      kind: "holiday",
      label: "Naher Feiertag",
      detail: date ? `${name} · ${date}` : name,
    };
  }
  if (slotKind === "event") {
    return {
      kind: "event",
      label: "Euer Event",
      detail: title?.trim() || "Bevorstehendes Event",
    };
  }
  if (slotKind === "menu_dish") {
    const dish =
      (typeof source.dishName === "string" && source.dishName) ||
      title ||
      assetLabel ||
      "Gericht";
    return {
      kind: "menu_dish",
      label: "Speisekarte",
      detail: dish,
    };
  }
  if (slotKind === "ambient") {
    return {
      kind: "ambient",
      label: "Galerie",
      detail: assetLabel?.trim() || title?.trim() || "Ambiente-Foto",
    };
  }
  return {
    kind: "brand",
    label: "Social-Marke",
    detail: assetLabel?.trim() || "Profilbild / Logo",
  };
}

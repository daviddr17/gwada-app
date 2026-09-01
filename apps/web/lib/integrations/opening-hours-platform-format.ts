import { WEEKDAY_ORDER, WEEKDAY_LABEL_DE } from "@/lib/constants/restaurant-profile";
import { exceptionOpenPeriods } from "@/lib/opening-hours/hours-periods";
import type { DateHoursException, DayHours, Weekday } from "@/lib/types/restaurant";

const GOOGLE_DAY: Record<Weekday, string> = {
  monday: "MONDAY",
  tuesday: "TUESDAY",
  wednesday: "WEDNESDAY",
  thursday: "THURSDAY",
  friday: "FRIDAY",
  saturday: "SATURDAY",
  sunday: "SUNDAY",
};

const FB_DAY: Record<Weekday, string> = {
  monday: "mon",
  tuesday: "tue",
  wednesday: "wed",
  thursday: "thu",
  friday: "fri",
  saturday: "sat",
  sunday: "sun",
};

const WEEKDAY_AFTER: Record<Weekday, Weekday> = {
  monday: "tuesday",
  tuesday: "wednesday",
  wednesday: "thursday",
  thursday: "friday",
  friday: "saturday",
  saturday: "sunday",
  sunday: "monday",
};

const WEEKDAY_BEFORE: Record<Weekday, Weekday> = {
  monday: "sunday",
  tuesday: "monday",
  wednesday: "tuesday",
  thursday: "wednesday",
  friday: "thursday",
  saturday: "friday",
  sunday: "saturday",
};

function parseHm(value: string | undefined): { hours: number; minutes: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value?.trim() ?? "");
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

function toFacebookHm(value: string | undefined): string | null {
  const p = parseHm(value);
  if (!p) return null;
  return `${String(p.hours).padStart(2, "0")}:${String(p.minutes).padStart(2, "0")}`;
}

export type OpeningHoursPayload = {
  weeklyHours: Record<Weekday, DayHours>;
  dateExceptions: DateHoursException[];
  kitchenHoursEnabled: boolean;
  kitchenWeeklyHours: Record<Weekday, DayHours>;
};

/** Google Business Profile: Küchenzeiten sind ein Eintrag in `moreHours`, nicht ein eigenes Top-Level-Feld. */
export const GOOGLE_KITCHEN_HOURS_TYPE_ID = "KITCHEN";

export function toGoogleKitchenMoreHours(
  kitchenWeeklyHours: Record<Weekday, DayHours>,
): { hoursTypeId: string; periods: ReturnType<typeof toGoogleRegularHours>["periods"] } {
  return {
    hoursTypeId: GOOGLE_KITCHEN_HOURS_TYPE_ID,
    periods: toGoogleRegularHours(kitchenWeeklyHours).periods,
  };
}

export function toGoogleRegularHours(weeklyHours: Record<Weekday, DayHours>) {
  const periods: Array<{
    openDay: string;
    openTime: { hours: number; minutes: number };
    closeDay: string;
    closeTime: { hours: number; minutes: number };
  }> = [];

  for (const day of WEEKDAY_ORDER) {
    const h = weeklyHours[day];
    if (h.closed) continue;
    const open = parseHm(h.open);
    const close = parseHm(h.close);
    if (!open || !close) continue;

    const openMins = open.hours * 60 + open.minutes;
    const closeMins = close.hours * 60 + close.minutes;
    const closeDay =
      closeMins <= openMins ? GOOGLE_DAY[WEEKDAY_AFTER[day]] : GOOGLE_DAY[day];

    periods.push({
      openDay: GOOGLE_DAY[day],
      openTime: open,
      closeDay,
      closeTime: close,
    });
  }

  return { periods };
}

export function toGoogleSpecialHours(
  dateExceptions: DateHoursException[],
): { specialHourPeriods: Array<Record<string, unknown>> } {
  const specialHourPeriods: Array<Record<string, unknown>> = [];

  for (const ex of dateExceptions) {
    const startDate = ex.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) continue;

    if (ex.closed) {
      specialHourPeriods.push({
        startDate,
        endDate: startDate,
        closed: true,
      });
      continue;
    }

    // Google: Pause = mehrere open-Perioden am selben Tag (kein closed-Intervall).
    for (const period of exceptionOpenPeriods(ex)) {
      const open = parseHm(period.open);
      const close = parseHm(period.close);
      if (!open || !close) continue;
      specialHourPeriods.push({
        startDate,
        endDate: startDate,
        openTime: open,
        closeTime: close,
        closed: false,
      });
    }
  }

  return { specialHourPeriods };
}

/** Meta Page `hours`: flache Keys `{day}_{1|2}_{open|close}` → `"HH:MM"`. */
export function toFacebookHours(
  weeklyHours: Record<Weekday, DayHours>,
): Record<string, string> {
  const hours: Record<string, string> = {};

  for (const day of WEEKDAY_ORDER) {
    const h = weeklyHours[day];
    if (h.closed) continue;
    const open = toFacebookHm(h.open);
    const close = toFacebookHm(h.close);
    if (!open || !close) continue;

    const fbDay = FB_DAY[day];
    hours[`${fbDay}_1_open`] = open;
    hours[`${fbDay}_1_close`] = close;
  }

  return hours;
}

export function openingHoursSyncSummary(
  weeklyHours: Record<Weekday, DayHours>,
): string {
  const openDays = WEEKDAY_ORDER.filter((d) => !weeklyHours[d].closed);
  if (openDays.length === 0) return "Alle Tage geschlossen";
  return `${openDays.length} Wochentage (${openDays.map((d) => WEEKDAY_LABEL_DE[d]).join(", ")})`;
}

const GOOGLE_TO_WEEKDAY: Record<string, Weekday> = {
  MONDAY: "monday",
  TUESDAY: "tuesday",
  WEDNESDAY: "wednesday",
  THURSDAY: "thursday",
  FRIDAY: "friday",
  SATURDAY: "saturday",
  SUNDAY: "sunday",
};

const FB_TO_WEEKDAY: Record<string, Weekday> = {
  mon: "monday",
  tue: "tuesday",
  wed: "wednesday",
  thu: "thursday",
  fri: "friday",
  sat: "saturday",
  sun: "sunday",
};

function googleTimeToHm(
  t?: { hours?: number; minutes?: number } | string,
): string | undefined {
  if (typeof t === "string") {
    const trimmed = t.trim();
    if (trimmed === "24:00") return "24:00";
    return toFacebookHm(trimmed) ?? undefined;
  }
  if (t?.hours === undefined || t.minutes === undefined) return undefined;
  if (t.hours === 24 && t.minutes === 0) return "24:00";
  if (t.hours < 0 || t.hours > 23 || t.minutes < 0 || t.minutes > 59) return undefined;
  return `${String(t.hours).padStart(2, "0")}:${String(t.minutes).padStart(2, "0")}`;
}

function hmToMinutes(value: string | undefined): number | null {
  const p = parseHm(value);
  if (!p) return null;
  return p.hours * 60 + p.minutes;
}

/** Google closeTime 24:00 / closeDay → Gwada open/close (overnight = close <= open). */
function googleCloseToLocalClose(
  openHm: string,
  openDayGoogle: string,
  closeDayGoogle: string,
  closeHm: string,
): string {
  if (closeHm === "24:00") return "00:00";
  if (openDayGoogle !== closeDayGoogle && closeHm === "00:00") return "00:00";
  return closeHm;
}

function isOvernightLocalOpenClose(openHm: string, closeHm: string): boolean {
  const openM = hmToMinutes(openHm);
  const closeM = hmToMinutes(closeHm);
  if (openM == null || closeM == null) return false;
  return closeM <= openM;
}

/** Google split overnight: Sa 00:00–02:00 gehört zu Fr 18:00–02:00. */
function isEarlyMorningOvernightTail(openHm: string, closeHm: string): boolean {
  const openM = hmToMinutes(openHm);
  const closeM = hmToMinutes(closeHm);
  if (openM == null || closeM == null) return false;
  return openM === 0 && closeM > 0 && closeM <= 12 * 60;
}

function canonicalHmForCompare(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (trimmed === "24:00") return "00:00";
  return toFacebookHm(trimmed) ?? "";
}

function canonicalDayHoursForCompare(h: DayHours): DayHours {
  if (h.closed) return { closed: true };
  const open = canonicalHmForCompare(h.open);
  const close = canonicalHmForCompare(h.close);
  if (!open || !close) return { closed: true };
  return { closed: false, open, close };
}

function closedWeeklyHours(): Record<Weekday, DayHours> {
  return Object.fromEntries(
    WEEKDAY_ORDER.map((d) => [d, { closed: true } as DayHours]),
  ) as Record<Weekday, DayHours>;
}

export function fromGoogleRegularHours(regularHours?: {
  periods?: Array<{
    openDay?: string;
    closeDay?: string;
    openTime?: { hours?: number; minutes?: number } | string;
    closeTime?: { hours?: number; minutes?: number } | string;
  }>;
}): Record<Weekday, DayHours> {
  const weekly = closedWeeklyHours();
  type Slot = { weekday: Weekday; open: string; close: string };
  const slots: Slot[] = [];

  for (const p of regularHours?.periods ?? []) {
    const openDayGoogle = p.openDay?.toUpperCase();
    if (!openDayGoogle) continue;
    const weekday = GOOGLE_TO_WEEKDAY[openDayGoogle];
    if (!weekday) continue;
    const open = googleTimeToHm(p.openTime);
    const closeRaw = googleTimeToHm(p.closeTime);
    if (!open || !closeRaw) continue;
    const closeDayGoogle = (p.closeDay ?? p.openDay)?.toUpperCase() ?? openDayGoogle;
    const close = googleCloseToLocalClose(
      open,
      openDayGoogle,
      closeDayGoogle,
      closeRaw,
    );
    slots.push({ weekday, open, close });
  }

  const merged = new Map<Weekday, Slot>();
  for (const slot of slots) {
    const prevDay = WEEKDAY_BEFORE[slot.weekday];
    const prev = merged.get(prevDay);
    if (
      isEarlyMorningOvernightTail(slot.open, slot.close) &&
      prev &&
      isOvernightLocalOpenClose(prev.open, prev.close)
    ) {
      merged.set(prevDay, { ...prev, close: slot.close });
      continue;
    }

    const existing = merged.get(slot.weekday);
    if (!existing) {
      merged.set(slot.weekday, slot);
      continue;
    }
    merged.set(slot.weekday, {
      weekday: slot.weekday,
      open: existing.open,
      close: slot.close,
    });
  }

  for (const [day, slot] of merged) {
    weekly[day] = { closed: false, open: slot.open, close: slot.close };
  }
  return weekly;
}

export function fromGoogleKitchenMoreHours(
  moreHours?: Array<{
    hoursTypeId?: string;
    periods?: Array<{
      openDay?: string;
      openTime?: { hours?: number; minutes?: number };
      closeTime?: { hours?: number; minutes?: number };
    }>;
  }>,
): Record<Weekday, DayHours> | null {
  const kitchen = moreHours?.find(
    (m) => m.hoursTypeId?.toUpperCase() === GOOGLE_KITCHEN_HOURS_TYPE_ID,
  );
  if (!kitchen) return null;
  return fromGoogleRegularHours({ periods: kitchen.periods });
}

export function fromFacebookPageHours(
  hours?: Record<string, unknown> | null,
): Record<Weekday, DayHours> {
  const weekly = closedWeeklyHours();
  if (!hours || typeof hours !== "object") return weekly;

  const hasFlatKeys = Object.keys(hours).some((k) => /^(mon|tue|wed|thu|fri|sat|sun)_\d_(open|close)$/.test(k));
  if (hasFlatKeys) {
    for (const day of WEEKDAY_ORDER) {
      const fbDay = FB_DAY[day];
      const open = toFacebookHm(String(hours[`${fbDay}_1_open`] ?? ""));
      const close = toFacebookHm(String(hours[`${fbDay}_1_close`] ?? ""));
      if (open && close) {
        weekly[day] = { closed: false, open, close };
      }
    }
    return weekly;
  }

  for (const [key, slots] of Object.entries(hours)) {
    const day = FB_TO_WEEKDAY[key.toLowerCase()];
    if (!day || !Array.isArray(slots) || slots.length === 0) continue;
    const slot = slots[0] as { open?: string; close?: string };
    const open = toFacebookHm(slot?.open);
    const close = toFacebookHm(slot?.close);
    if (!open || !close) continue;
    weekly[day] = { closed: false, open, close };
  }
  return weekly;
}

function googleSpecialDateToYmd(
  value: unknown,
): string | null {
  if (typeof value === "string") {
    const date = value.trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  }
  if (value && typeof value === "object") {
    const o = value as { year?: number; month?: number; day?: number };
    if (
      typeof o.year === "number" &&
      typeof o.month === "number" &&
      typeof o.day === "number"
    ) {
      return `${o.year}-${String(o.month).padStart(2, "0")}-${String(o.day).padStart(2, "0")}`;
    }
  }
  return null;
}

export function fromGoogleSpecialHours(
  specialHours?: {
    specialHourPeriods?: Array<{
      startDate?: string | { year?: number; month?: number; day?: number };
      endDate?: string | { year?: number; month?: number; day?: number };
      closed?: boolean;
      openTime?: { hours?: number; minutes?: number };
      closeTime?: { hours?: number; minutes?: number };
    }>;
  },
): DateHoursException[] {
  const byDate = new Map<string, DateHoursException>();

  for (const p of specialHours?.specialHourPeriods ?? []) {
    const date = googleSpecialDateToYmd(p.startDate);
    if (!date) continue;
    if (p.closed) {
      byDate.set(date, { id: date, date, closed: true });
      continue;
    }
    const open = googleTimeToHm(p.openTime);
    const close = googleTimeToHm(p.closeTime);
    if (!open || !close) continue;
    const existing = byDate.get(date);
    if (!existing || existing.closed) {
      byDate.set(date, {
        id: date,
        date,
        closed: false,
        periods: [{ open, close }],
        open,
        close,
      });
      continue;
    }
    const periods = exceptionOpenPeriods({
      closed: false,
      periods: [...(existing.periods ?? []), { open, close }],
      open: existing.open,
      close: existing.close,
    });
    byDate.set(date, {
      id: date,
      date,
      closed: false,
      periods,
      open: periods[0]?.open,
      close: periods[periods.length - 1]?.close,
    });
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Stabiler Vergleichs-Fingerabdruck für Wochenpläne. */
export function weeklyHoursFingerprint(
  weekly: Record<Weekday, DayHours>,
): string {
  return WEEKDAY_ORDER.map((day) => {
    const h = canonicalDayHoursForCompare(weekly[day]);
    if (h.closed) return `${day}:closed`;
    return `${day}:${h.open}-${h.close}`;
  }).join("|");
}

export function weeklyHoursEqual(
  a: Record<Weekday, DayHours>,
  b: Record<Weekday, DayHours>,
): boolean {
  return weeklyHoursFingerprint(a) === weeklyHoursFingerprint(b);
}

export function futureExceptionsFingerprint(
  exceptions: DateHoursException[],
  todayYmd: string,
): string {
  return exceptions
    .filter((ex) => ex.date >= todayYmd)
    .sort((x, y) => x.date.localeCompare(y.date))
    .map((ex) => {
      if (ex.closed) return `${ex.date}:closed`;
      const periods = exceptionOpenPeriods(ex);
      if (periods.length === 0) return `${ex.date}:closed`;
      return `${ex.date}:${periods.map((p) => `${toFacebookHm(p.open) ?? ""}-${toFacebookHm(p.close) ?? ""}`).join(",")}`;
    })
    .join("|");
}

export function futureExceptionsEqual(
  local: DateHoursException[],
  remote: DateHoursException[],
  todayYmd: string,
): boolean {
  return (
    futureExceptionsFingerprint(local, todayYmd) ===
    futureExceptionsFingerprint(remote, todayYmd)
  );
}

import { WEEKDAY_ORDER, WEEKDAY_LABEL_DE } from "@/lib/constants/restaurant-profile";
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

    const open = parseHm(ex.open);
    const close = parseHm(ex.close);
    if (!open || !close) continue;

    specialHourPeriods.push({
      startDate,
      endDate: startDate,
      openTime: open,
      closeTime: close,
      closed: false,
    });
  }

  return { specialHourPeriods };
}

export function toFacebookHours(
  weeklyHours: Record<Weekday, DayHours>,
): Record<string, Array<{ open: string; close: string }>> {
  const hours: Record<string, Array<{ open: string; close: string }>> = {};

  for (const day of WEEKDAY_ORDER) {
    const h = weeklyHours[day];
    if (h.closed) continue;
    const open = toFacebookHm(h.open);
    const close = toFacebookHm(h.close);
    if (!open || !close) continue;
    hours[FB_DAY[day]] = [{ open, close }];
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

function googleTimeToHm(t?: { hours?: number; minutes?: number }): string | undefined {
  if (t?.hours === undefined || t.minutes === undefined) return undefined;
  return `${String(t.hours).padStart(2, "0")}:${String(t.minutes).padStart(2, "0")}`;
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
    openTime?: { hours?: number; minutes?: number };
    closeTime?: { hours?: number; minutes?: number };
  }>;
}): Record<Weekday, DayHours> {
  const weekly = closedWeeklyHours();
  for (const p of regularHours?.periods ?? []) {
    const day = p.openDay ? GOOGLE_TO_WEEKDAY[p.openDay] : undefined;
    if (!day) continue;
    const open = googleTimeToHm(p.openTime);
    const close = googleTimeToHm(p.closeTime);
    if (!open || !close) continue;
    weekly[day] = { closed: false, open, close };
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
  hours?: Record<string, Array<{ open?: string; close?: string }>> | null,
): Record<Weekday, DayHours> {
  const weekly = closedWeeklyHours();
  if (!hours || typeof hours !== "object") return weekly;

  for (const [key, slots] of Object.entries(hours)) {
    const day = FB_TO_WEEKDAY[key.toLowerCase()];
    if (!day || !Array.isArray(slots) || slots.length === 0) continue;
    const slot = slots[0];
    const open = toFacebookHm(slot?.open);
    const close = toFacebookHm(slot?.close);
    if (!open || !close) continue;
    weekly[day] = { closed: false, open, close };
  }
  return weekly;
}

export function fromGoogleSpecialHours(
  specialHours?: {
    specialHourPeriods?: Array<{
      startDate?: string;
      endDate?: string;
      closed?: boolean;
      openTime?: { hours?: number; minutes?: number };
      closeTime?: { hours?: number; minutes?: number };
    }>;
  },
): DateHoursException[] {
  const out: DateHoursException[] = [];
  for (const p of specialHours?.specialHourPeriods ?? []) {
    const date = p.startDate?.trim();
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (p.closed) {
      out.push({
        id: date,
        date,
        closed: true,
      });
      continue;
    }
    const open = googleTimeToHm(p.openTime);
    const close = googleTimeToHm(p.closeTime);
    if (!open || !close) continue;
    out.push({ id: date, date, closed: false, open, close });
  }
  return out;
}

/** Stabiler Vergleichs-Fingerabdruck für Wochenpläne. */
export function weeklyHoursFingerprint(
  weekly: Record<Weekday, DayHours>,
): string {
  return WEEKDAY_ORDER.map((day) => {
    const h = weekly[day];
    if (h.closed) return `${day}:closed`;
    const open = toFacebookHm(h.open) ?? "";
    const close = toFacebookHm(h.close) ?? "";
    return `${day}:${open}-${close}`;
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
      const open = toFacebookHm(ex.open) ?? "";
      const close = toFacebookHm(ex.close) ?? "";
      return `${ex.date}:${open}-${close}`;
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

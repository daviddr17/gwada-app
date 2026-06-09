import { defaultWeeklyHours } from "@/lib/constants/restaurant-profile";
import type {
  DateHoursException,
  DayHours,
  Weekday,
} from "@/lib/types/restaurant";
import type { ReservationListRow } from "@/lib/supabase/reservations-db";

/** YYYY-MM-DD in lokaler Kalenderzeit */
export function localDateStringForDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Konsistent mit `WEEKDAY_ORDER` (Mo–So). */
export function jsDateToWeekday(d: Date): Weekday {
  const map: Weekday[] = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  return map[d.getDay()]!;
}

export function resolveHoursForLocalCalendarDay(
  day: Date,
  weeklyHours: Record<Weekday, DayHours>,
  dateExceptions: DateHoursException[],
): DayHours {
  const key = localDateStringForDate(day);
  const ex = dateExceptions.find((e) => e.date === key);
  if (ex) {
    return {
      closed: ex.closed,
      open: ex.open,
      close: ex.close,
    };
  }
  return weeklyHours[jsDateToWeekday(day)];
}

export function hhmmToMinutes(t: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return 0;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return 0;
  return h * 60 + min;
}

export function minutesToHHmm(total: number): string {
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Mindest-/Höchstminute aus Reservierungen (lokal), für Fallback wenn geschlossen oder ohne Zeiten. */
export function fallbackSlotRangeFromReservations(
  reservations: ReservationListRow[],
  day: Date,
): { openMin: number; closeMin: number } {
  const dflt = defaultWeeklyHours()[jsDateToWeekday(day)];
  const baseOpen = dflt.closed || !dflt.open ? 11 * 60 + 30 : hhmmToMinutes(dflt.open);
  const baseClose = dflt.closed || !dflt.close ? 22 * 60 : hhmmToMinutes(dflt.close);
  if (reservations.length === 0) {
    return { openMin: baseOpen, closeMin: baseClose };
  }
  let minM = Infinity;
  let maxM = -Infinity;
  for (const r of reservations) {
    const s = new Date(r.starts_at);
    const e = new Date(r.ends_at);
    minM = Math.min(minM, s.getHours() * 60 + s.getMinutes());
    maxM = Math.max(maxM, e.getHours() * 60 + e.getMinutes());
  }
  if (!Number.isFinite(minM) || !Number.isFinite(maxM)) {
    return { openMin: baseOpen, closeMin: baseClose };
  }
  const openMin = Math.min(baseOpen, Math.floor(minM));
  const closeMin = Math.max(baseClose, Math.min(Math.ceil(maxM), 24 * 60 - 1));
  return { openMin, closeMin };
}

/**
 * Startminuten von Slots innerhalb der Öffnungszeiten (lokal).
 * @param stepMinutes z. B. 15 (grob) oder 1 (Minutentakt für Zeitleisten).
 */
export function openingDaySlotStartsMinutes(
  hours: DayHours,
  fallback: { openMin: number; closeMin: number },
  stepMinutes: number = 15,
): number[] {
  const step = Math.max(1, Math.min(60, Math.round(stepMinutes)));
  let openM: number;
  let closeM: number;
  if (hours.closed || !hours.open?.trim() || !hours.close?.trim()) {
    openM = fallback.openMin;
    closeM = fallback.closeMin;
  } else {
    openM = hhmmToMinutes(hours.open);
    closeM = hhmmToMinutes(hours.close);
  }
  if (closeM <= openM) {
    closeM = Math.min(openM + step, 24 * 60 - step);
  }
  const start = Math.ceil(openM / step) * step;
  const end = Math.floor(closeM / step) * step;
  const out: number[] = [];
  for (let t = start; t <= end && t < 24 * 60; t += step) {
    out.push(t);
  }
  if (out.length === 0) {
    const mid = Math.min(Math.max(openM, 12 * 60), 24 * 60 - step);
    out.push(Math.floor(mid / step) * step);
  }
  return out;
}

function normalizeMinMinutesBeforeClosing(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 60;
  return Math.min(480, Math.max(0, Math.round(value)));
}

/**
 * Buchbare Start-Slots: Öffnung bis spätester Reservierungsbeginn
 * (Schließzeit minus `minMinutesBeforeClosing` aus den Einstellungen).
 */
export function openingDayBookableSlotStartsMinutes(
  hours: DayHours,
  fallback: { openMin: number; closeMin: number },
  stepMinutes: number = 15,
  minMinutesBeforeClosing: number = 60,
): number[] {
  const slots = openingDaySlotStartsMinutes(hours, fallback, stepMinutes);
  const buffer = normalizeMinMinutesBeforeClosing(minMinutesBeforeClosing);
  if (buffer <= 0 || slots.length === 0) return slots;

  let closeM: number;
  if (hours.closed || !hours.close?.trim()) {
    closeM = fallback.closeMin;
  } else {
    closeM = hhmmToMinutes(hours.close);
  }
  const latestStartM = closeM - buffer;
  const filtered = slots.filter((m) => m <= latestStartM);
  return filtered.length > 0 ? filtered : slots.slice(0, 1);
}

export function localDateAtSlotMinutes(day: Date, minutesFromMidnight: number): Date {
  const h = Math.floor(minutesFromMidnight / 60);
  const m = minutesFromMidnight % 60;
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m, 0, 0);
}

export { reservationActiveAtInstant } from "@gwada/shared";

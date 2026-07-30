import type {
  DateHoursException,
  DayHours,
  Weekday,
} from "@/lib/types/restaurant";
import {
  dayHoursOpenPeriods,
  isMinutesWithinOpenPeriods,
} from "@/lib/opening-hours/hours-periods";
import { resolveHoursForLocalCalendarDay } from "@/lib/reservations/day-opening-slots";

export type PublicOpeningStatusState = "open" | "opens_later" | "closed";

export type PublicOpeningStatus = {
  state: PublicOpeningStatusState;
  label: string;
  detail: string | null;
};

export function getPublicOpeningStatus(
  weeklyHours: Record<Weekday, DayHours>,
  dateExceptions: DateHoursException[] = [],
  now: Date = new Date(),
): PublicOpeningStatus {
  const hours = resolveHoursForLocalCalendarDay(now, weeklyHours, dateExceptions);
  const periods = dayHoursOpenPeriods(hours);

  if (periods.length === 0) {
    return {
      state: "closed",
      label: "Heute geschlossen",
      detail: null,
    };
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  if (isMinutesWithinOpenPeriods(nowMinutes, periods)) {
    const current = periods.find((p) => {
      const openParts = p.open.split(":").map(Number);
      const closeParts = p.close.split(":").map(Number);
      const openM = (openParts[0] ?? 0) * 60 + (openParts[1] ?? 0);
      const closeM = (closeParts[0] ?? 0) * 60 + (closeParts[1] ?? 0);
      return nowMinutes >= openM && nowMinutes < closeM;
    });
    return {
      state: "open",
      label: "Geöffnet",
      detail: current ? `bis ${current.close} Uhr` : null,
    };
  }

  const next = periods.find((p) => {
    const openParts = p.open.split(":").map(Number);
    const openM = (openParts[0] ?? 0) * 60 + (openParts[1] ?? 0);
    return nowMinutes < openM;
  });
  if (next) {
    return {
      state: "opens_later",
      label: `Öffnet um ${next.open} Uhr`,
      detail: null,
    };
  }

  return {
    state: "closed",
    label: "Geschlossen",
    detail: null,
  };
}

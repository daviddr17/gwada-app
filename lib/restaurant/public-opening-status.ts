import type {
  DateHoursException,
  DayHours,
  Weekday,
} from "@/lib/types/restaurant";
import {
  hhmmToMinutes,
  resolveHoursForLocalCalendarDay,
} from "@/lib/reservations/day-opening-slots";

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

  if (hours.closed || !hours.open || !hours.close) {
    return {
      state: "closed",
      label: "Heute geschlossen",
      detail: null,
    };
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const openM = hhmmToMinutes(hours.open);
  const closeM = hhmmToMinutes(hours.close);

  if (nowMinutes >= openM && nowMinutes < closeM) {
    return {
      state: "open",
      label: "Geöffnet",
      detail: `bis ${hours.close} Uhr`,
    };
  }

  if (nowMinutes < openM) {
    return {
      state: "opens_later",
      label: `Öffnet um ${hours.open} Uhr`,
      detail: null,
    };
  }

  return {
    state: "closed",
    label: "Geschlossen",
    detail: null,
  };
}

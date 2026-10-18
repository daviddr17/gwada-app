import type {
  DateHoursException,
  DayHours,
  Weekday,
} from "@/lib/types/restaurant";
import {
  berlinCalendarYmd,
  isOpeningHoursClosureActive,
  type OpeningHoursClosure,
} from "@/lib/opening-hours/closure";
import {
  dayHoursOpenPeriods,
  isMinutesWithinOpenPeriods,
} from "@/lib/opening-hours/hours-periods";
import { resolveHoursForLocalCalendarDay } from "@/lib/reservations/day-opening-slots";
import { DEFAULT_RESTAURANT_TIMEZONE } from "@/lib/restaurant/restaurant-timezone";

export type PublicOpeningStatusState =
  | "open"
  | "opens_later"
  | "closed"
  | "temporary_closed"
  | "permanent_closed";

export type PublicOpeningStatus = {
  state: PublicOpeningStatusState;
  label: string;
  detail: string | null;
};

function formatDeDate(ymd: string): string {
  try {
    return new Date(`${ymd}T12:00:00`).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: DEFAULT_RESTAURANT_TIMEZONE,
    });
  } catch {
    return ymd;
  }
}

export function getPublicOpeningStatus(
  weeklyHours: Record<Weekday, DayHours>,
  dateExceptions: DateHoursException[] = [],
  now: Date = new Date(),
  closure: OpeningHoursClosure = { mode: "open", from: null, until: null },
): PublicOpeningStatus {
  const todayYmd = berlinCalendarYmd(now);
  if (isOpeningHoursClosureActive(closure, todayYmd)) {
    if (closure.mode === "permanent") {
      return {
        state: "permanent_closed",
        label: "Dauerhaft geschlossen",
        detail: null,
      };
    }
    const until = closure.until;
    return {
      state: "temporary_closed",
      label: "Vorübergehend geschlossen",
      detail: until ? `bis ${formatDeDate(until)}` : null,
    };
  }

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

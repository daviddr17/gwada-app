import {
  exclusiveUtcIsoAfterLocalVisibleEnd,
  localDayStartToUtcIso,
  startOfLocalDay,
} from "@/lib/reservations/month-range";

/** Aktuelle Kalenderwoche (Montag–Sonntag) in lokaler Zeit. */
export function localCurrentWeekRange(today: Date = new Date()): {
  weekStart: Date;
  weekEnd: Date;
  today: Date;
} {
  const todayStart = startOfLocalDay(today);
  const dow = todayStart.getDay();
  const toMonday = dow === 0 ? -6 : 1 - dow;
  const weekStart = new Date(todayStart);
  weekStart.setDate(todayStart.getDate() + toMonday);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  return { weekStart, weekEnd, today: todayStart };
}

export function weekRangeUtcIso(today: Date = new Date()): {
  rangeStartIso: string;
  rangeEndExclusiveIso: string;
} {
  const { weekStart, weekEnd } = localCurrentWeekRange(today);
  return {
    rangeStartIso: localDayStartToUtcIso(weekStart),
    rangeEndExclusiveIso: exclusiveUtcIsoAfterLocalVisibleEnd(weekEnd),
  };
}

/** Ab heute, für offene / unbestätigte Reservierungen. */
export function fromTodayUtcIsoRange(yearsAhead = 1): {
  rangeStartIso: string;
  rangeEndExclusiveIso: string;
} {
  const today = startOfLocalDay(new Date());
  const end = new Date(today);
  end.setFullYear(end.getFullYear() + yearsAhead);
  return {
    rangeStartIso: localDayStartToUtcIso(today),
    rangeEndExclusiveIso: exclusiveUtcIsoAfterLocalVisibleEnd(end),
  };
}

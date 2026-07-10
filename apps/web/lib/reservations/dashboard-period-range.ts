import {
  addRestaurantCalendarDaysYmd,
  DEFAULT_RESTAURANT_TIMEZONE,
  restaurantDayBoundsIso,
  restaurantTodayYmd,
  restaurantZonedDateKey,
  utcInstantForRestaurantLocal,
} from "@/lib/restaurant/restaurant-timezone";
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

function restaurantWeekdayMondayOffset(
  ymd: string,
  timeZone: string,
): number {
  const parts = ymd.split("-").map(Number);
  const instant = utcInstantForRestaurantLocal(
    parts[0]!,
    parts[1]!,
    parts[2]!,
    12,
    0,
    timeZone,
  );
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(instant);
  const map: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  return map[weekday] ?? 0;
}

/** Aktuelle Kalenderwoche (Montag–Sonntag) in Restaurant-Zeitzone. */
export function restaurantWeekRangeUtcIso(
  timeZone: string = DEFAULT_RESTAURANT_TIMEZONE,
  ref: Date = new Date(),
): {
  rangeStartIso: string;
  rangeEndExclusiveIso: string;
} {
  const todayYmd = restaurantTodayYmd(timeZone, ref);
  const mondayOffset = restaurantWeekdayMondayOffset(todayYmd, timeZone);
  const mondayYmd = addRestaurantCalendarDaysYmd(
    todayYmd,
    -mondayOffset,
    timeZone,
  );
  const sundayYmd = addRestaurantCalendarDaysYmd(mondayYmd, 6, timeZone);
  const start = restaurantDayBoundsIso(mondayYmd, timeZone, ref).start;
  const end = restaurantDayBoundsIso(sundayYmd, timeZone, ref).end;
  return { rangeStartIso: start, rangeEndExclusiveIso: end };
}

/** Ab heute (Restaurant-Kalendertag), für offene / unbestätigte Reservierungen. */
export function restaurantFromTodayUtcIsoRange(
  timeZone: string = DEFAULT_RESTAURANT_TIMEZONE,
  yearsAhead = 1,
  ref: Date = new Date(),
): {
  rangeStartIso: string;
  rangeEndExclusiveIso: string;
} {
  const todayYmd = restaurantTodayYmd(timeZone, ref);
  const start = restaurantDayBoundsIso(todayYmd, timeZone, ref).start;
  const endYmd = addRestaurantCalendarDaysYmd(
    todayYmd,
    365 * yearsAhead,
    timeZone,
  );
  const end = restaurantDayBoundsIso(endYmd, timeZone, ref).start;
  return { rangeStartIso: start, rangeEndExclusiveIso: end };
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

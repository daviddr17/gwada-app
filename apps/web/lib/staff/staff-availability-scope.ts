import {
  addDays,
  localDayKey,
  parseLocalDayKey,
  startOfWeekMonday,
} from "@/lib/staff/shift-schedule-range";
import type { StaffAvailabilityWeekday } from "@/lib/types/staff-availability";
import { STAFF_AVAILABILITY_WEEKDAY_ORDER } from "@/lib/types/staff-availability";

export type StaffAvailabilityScopeMode = "dates" | "weeks";

export type StaffAvailabilityWeekOption = {
  weekStartYmd: string;
  isoWeek: number;
  label: string;
  rangeLabel: string;
};

const WEEKDAY_OFFSET: Record<StaffAvailabilityWeekday, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
};

/** ISO-Kalenderwoche für eine Montags-Woche. */
export function isoWeekFromMonday(monday: Date): number {
  const thursday = addDays(monday, 3);
  const year = thursday.getFullYear();
  const week1Monday = startOfWeekMonday(new Date(year, 0, 4));
  const diffDays = Math.round(
    (startOfWeekMonday(monday).getTime() - week1Monday.getTime()) /
      (24 * 60 * 60 * 1000),
  );
  return Math.floor(diffDays / 7) + 1;
}

const shortDayFmt = new Intl.DateTimeFormat("de-DE", {
  day: "numeric",
  month: "numeric",
});

export function buildUpcomingWeekOptions(
  count = 8,
  from: Date = new Date(),
): StaffAvailabilityWeekOption[] {
  const monday = startOfWeekMonday(from);
  const options: StaffAvailabilityWeekOption[] = [];
  for (let i = 0; i < count; i += 1) {
    const start = addDays(monday, i * 7);
    const end = addDays(start, 6);
    const weekStartYmd = localDayKey(start);
    const isoWeek = isoWeekFromMonday(start);
    const rangeLabel = `${shortDayFmt.format(start)}–${shortDayFmt.format(end)}`;
    options.push({
      weekStartYmd,
      isoWeek,
      rangeLabel,
      label: `KW ${isoWeek} · ${rangeLabel}`,
    });
  }
  return options;
}

/** Wochentage in ausgewählten (Mo-basierten) Wochen → YMD-Daten. */
export function expandWeekdaysInWeeks(
  weekStartYmds: readonly string[],
  weekdays: readonly StaffAvailabilityWeekday[],
): string[] {
  if (weekStartYmds.length === 0 || weekdays.length === 0) return [];
  const dates = new Set<string>();
  for (const weekStartYmd of weekStartYmds) {
    const monday = parseLocalDayKey(weekStartYmd);
    for (const weekday of weekdays) {
      const offset = WEEKDAY_OFFSET[weekday];
      dates.add(localDayKey(addDays(monday, offset)));
    }
  }
  return [...dates].sort();
}

export function toggleSortedUnique(
  values: readonly string[],
  value: string,
): string[] {
  const set = new Set(values);
  if (set.has(value)) set.delete(value);
  else set.add(value);
  return [...set].sort();
}

export function toggleWeekday(
  selected: readonly StaffAvailabilityWeekday[],
  weekday: StaffAvailabilityWeekday,
): StaffAvailabilityWeekday[] {
  const set = new Set(selected);
  if (set.has(weekday)) set.delete(weekday);
  else set.add(weekday);
  return STAFF_AVAILABILITY_WEEKDAY_ORDER.filter((d) => set.has(d));
}

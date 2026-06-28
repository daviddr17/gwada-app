import type { StaffTodoRecurrence } from "@/lib/types/staff-todos";
import {
  DEFAULT_RESTAURANT_TIMEZONE,
  readRestaurantZonedParts,
  utcInstantForRestaurantLocal,
} from "@/lib/restaurant/restaurant-timezone";

/** @deprecated Alias — bitte `utcInstantForRestaurantLocal` nutzen. */
export const utcInstantForZonedLocal = utcInstantForRestaurantLocal;

/** DB-Schlüssel für ad_hoc / einmalige ToDos (keine echte Periode). */
export const STAFF_TODO_AD_HOC_PERIOD_START = "1970-01-01T00:00:00.000Z";

/** ISO-Wochentag (Mo=1 … So=7) in Restaurant-Zeitzone. */
function zonedIsoWeekday(date: Date, timeZone: string): number {
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(date);
  switch (wd) {
    case "Mon":
      return 1;
    case "Tue":
      return 2;
    case "Wed":
      return 3;
    case "Thu":
      return 4;
    case "Fri":
      return 5;
    case "Sat":
      return 6;
    default:
      return 7;
  }
}

export function staffTodoPeriodStart(
  recurrence: StaffTodoRecurrence,
  ref: Date = new Date(),
  timeZone: string = DEFAULT_RESTAURANT_TIMEZONE,
): Date | null {
  const z = readRestaurantZonedParts(ref, timeZone);
  switch (recurrence) {
    case "hourly":
      return utcInstantForRestaurantLocal(
        z.year,
        z.month,
        z.day,
        z.hour,
        0,
        timeZone,
      );
    case "daily":
      return utcInstantForRestaurantLocal(z.year, z.month, z.day, 0, 0, timeZone);
    case "weekly": {
      const isoDow = zonedIsoWeekday(ref, timeZone);
      const dayUtc = Date.UTC(z.year, z.month - 1, z.day);
      const mondayUtc = dayUtc - (isoDow - 1) * 86_400_000;
      const monday = new Date(mondayUtc);
      return utcInstantForRestaurantLocal(
        monday.getUTCFullYear(),
        monday.getUTCMonth() + 1,
        monday.getUTCDate(),
        0,
        0,
        timeZone,
      );
    }
    case "monthly":
      return utcInstantForRestaurantLocal(z.year, z.month, 1, 0, 0, timeZone);
    case "ad_hoc":
      return null;
    default:
      return utcInstantForRestaurantLocal(z.year, z.month, z.day, 0, 0, timeZone);
  }
}

/** Perioden-Anfang als ISO für UNIQUE (todo_id, staff_id, period_start). */
export function staffTodoPeriodStartIsoForStorage(
  recurrence: StaffTodoRecurrence | null,
  ref: Date = new Date(),
  timeZone: string = DEFAULT_RESTAURANT_TIMEZONE,
): string {
  if (!recurrence || recurrence === "ad_hoc") {
    return STAFF_TODO_AD_HOC_PERIOD_START;
  }
  const start = staffTodoPeriodStart(recurrence, ref, timeZone);
  return start?.toISOString() ?? STAFF_TODO_AD_HOC_PERIOD_START;
}

export function parseStaffTodoPeriodStartMs(
  value: string | null | undefined,
): number | null {
  if (value == null || value === "") return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** PostgREST liefert oft `+00:00` statt `.000Z` — per Timestamp vergleichen. */
export function staffTodoPeriodStartMatches(
  stored: string | null | undefined,
  expectedIso: string,
): boolean {
  const storedMs = parseStaffTodoPeriodStartMs(stored);
  const expectedMs = parseStaffTodoPeriodStartMs(expectedIso);
  if (storedMs != null && expectedMs != null) return storedMs === expectedMs;
  return stored === expectedIso;
}

export type StaffTodoCompletionTiming = {
  completed_at: string;
  reopened_at: string | null;
  staff_id: string;
  period_start?: string;
};

export function latestActiveCompletionAt(
  completions: readonly StaffTodoCompletionTiming[],
  todo: { completion_mode: "any_one" | "each_assignee" },
  staffId: string,
): string | null {
  const active = completions.filter((c) => !c.reopened_at && c.completed_at);
  const relevant =
    todo.completion_mode === "each_assignee"
      ? active.filter((c) => c.staff_id === staffId)
      : active;
  if (relevant.length === 0) return null;
  return relevant.reduce((latest, c) =>
    new Date(c.completed_at) > new Date(latest) ? c.completed_at : latest,
  relevant[0]!.completed_at);
}

export function activeCompletionsInCurrentPeriod<
  T extends StaffTodoCompletionTiming,
>(
  todo: {
    recurrence: StaffTodoRecurrence | null;
    completion_mode: "any_one" | "each_assignee";
  },
  completions: readonly T[],
  ref: Date = new Date(),
  timeZone: string = DEFAULT_RESTAURANT_TIMEZONE,
): T[] {
  const active = completions.filter((c) => !c.reopened_at && c.completed_at);

  if (!todo.recurrence || todo.recurrence === "ad_hoc") {
    const periodIso = staffTodoPeriodStartIsoForStorage(null, ref, timeZone);
    return active.filter(
      (c) =>
        c.period_start == null ||
        staffTodoPeriodStartMatches(c.period_start, periodIso),
    );
  }

  const currentPeriodIso = staffTodoPeriodStartIsoForStorage(
    todo.recurrence,
    ref,
    timeZone,
  );
  const periodStart = staffTodoPeriodStart(todo.recurrence, ref, timeZone);
  if (!periodStart) return active;
  const startMs = periodStart.getTime();

  return active.filter((c) => {
    if (
      c.period_start != null &&
      staffTodoPeriodStartMatches(c.period_start, currentPeriodIso)
    ) {
      return true;
    }
    return new Date(c.completed_at).getTime() >= startMs;
  });
}

/** Erledigt für aktuelle Periode (bei Wiederholung) bzw. insgesamt (ad_hoc). */
export function isStaffTodoDoneForStaff(
  todo: {
    recurrence: StaffTodoRecurrence | null;
    completion_mode: "any_one" | "each_assignee";
  },
  completions: readonly StaffTodoCompletionTiming[],
  staffId: string,
  ref: Date = new Date(),
  timeZone: string = DEFAULT_RESTAURANT_TIMEZONE,
): boolean {
  const periodCompletions = activeCompletionsInCurrentPeriod(
    todo,
    completions,
    ref,
    timeZone,
  );
  return latestActiveCompletionAt(periodCompletions, todo, staffId) != null;
}

import type {
  RestaurantStaffTodoCompletionRow,
  StaffTodoRecurrence,
} from "@/lib/types/staff-todos";
import {
  parseStaffTodoPeriodStartMs,
  staffTodoPeriodStart,
  staffTodoPeriodStartIsoForStorage,
  staffTodoPeriodStartMatches,
  type StaffTodoCompletionTiming,
} from "@/lib/staff/staff-todo-due";
import { DEFAULT_RESTAURANT_TIMEZONE } from "@/lib/restaurant/restaurant-timezone";

/** Abdeckung für monatliche Perioden (inkl. Monatswechsel). */
export const STAFF_TODO_COMPLETION_LOOKBACK_MS = 34 * 24 * 60 * 60 * 1000;

const HOUR_MS = 60 * 60 * 1000;

export function staffTodoCompletionLookbackMs(
  recurrences: readonly (StaffTodoRecurrence | null | undefined)[],
): number {
  const onlyHourly = recurrences.every(
    (r) => !r || r === "ad_hoc" || r === "hourly",
  );
  const hasHourly = recurrences.some((r) => r === "hourly");
  if (onlyHourly && hasHourly) return 3 * HOUR_MS;
  if (hasHourly) return STAFF_TODO_COMPLETION_LOOKBACK_MS;
  return STAFF_TODO_COMPLETION_LOOKBACK_MS;
}

export function staffTodoCompletionLookbackIso(
  recurrences: readonly (StaffTodoRecurrence | null | undefined)[],
  ref: Date = new Date(),
): string {
  const ms = staffTodoCompletionLookbackMs(recurrences);
  return new Date(ref.getTime() - ms).toISOString();
}

type CompletionLike = Pick<
  RestaurantStaffTodoCompletionRow,
  "todo_id" | "staff_id" | "completed_at" | "reopened_at" | "period_start"
>;

/** Pro ToDo + Mitarbeiter + Periode nur die jüngste aktive Erledigung. */
export function latestActiveCompletionsPerStaff<
  T extends CompletionLike & Record<string, unknown>,
>(rows: readonly T[]): T[] {
  const best = new Map<string, T>();
  for (const row of rows) {
    if (row.reopened_at) continue;
    if (!row.completed_at) continue;
    const periodKey =
      row.period_start != null
        ? String(parseStaffTodoPeriodStartMs(row.period_start) ?? row.period_start)
        : "";
    const key = `${row.todo_id}\0${row.staff_id}\0${periodKey}`;
    const prev = best.get(key);
    if (
      !prev ||
      new Date(row.completed_at).getTime() >
        new Date(prev.completed_at).getTime()
    ) {
      best.set(key, row);
    }
  }
  return [...best.values()];
}

export function groupCompletionsByTodoId<
  T extends CompletionLike & Record<string, unknown>,
>(rows: readonly T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of latestActiveCompletionsPerStaff(rows)) {
    const list = map.get(row.todo_id) ?? [];
    list.push(row);
    map.set(row.todo_id, list);
  }
  return map;
}

/** Nur aktive Erledigungen der laufenden Periode (Variante B). */
export function currentPeriodCompletionsForTodo<
  T extends StaffTodoCompletionTiming & { todo_id?: string },
>(
  todo: { recurrence: StaffTodoRecurrence | null },
  rows: readonly T[],
  ref: Date = new Date(),
  timeZone: string = DEFAULT_RESTAURANT_TIMEZONE,
): T[] {
  const periodIso = staffTodoPeriodStartIsoForStorage(
    todo.recurrence,
    ref,
    timeZone,
  );
  const periodStart =
    todo.recurrence && todo.recurrence !== "ad_hoc"
      ? staffTodoPeriodStart(todo.recurrence, ref, timeZone)
      : null;
  const startMs = periodStart?.getTime();

  return rows.filter((c) => {
    if (c.reopened_at || !c.completed_at) return false;
    if (staffTodoPeriodStartMatches(c.period_start, periodIso)) return true;
    if (startMs != null && new Date(c.completed_at).getTime() >= startMs) {
      return true;
    }
    return false;
  });
}

export function mapTodoCompletionsToCurrentPeriod<
  T extends StaffTodoCompletionTiming & { todo_id: string },
>(
  todos: readonly { id: string; recurrence: StaffTodoRecurrence | null }[],
  byTodo: ReadonlyMap<string, readonly T[]>,
  ref: Date = new Date(),
  timeZone: string = DEFAULT_RESTAURANT_TIMEZONE,
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const todo of todos) {
    map.set(
      todo.id,
      currentPeriodCompletionsForTodo(
        todo,
        byTodo.get(todo.id) ?? [],
        ref,
        timeZone,
      ),
    );
  }
  return map;
}

import type { StaffTodoRecurrence } from "@/lib/types/staff-todos";

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfLocalWeek(d: Date): Date {
  const x = startOfLocalDay(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

function startOfLocalMonth(d: Date): Date {
  const x = startOfLocalDay(d);
  x.setDate(1);
  return x;
}

function startOfLocalHour(d: Date): Date {
  const x = new Date(d);
  x.setMinutes(0, 0, 0);
  return x;
}

export function staffTodoPeriodStart(
  recurrence: StaffTodoRecurrence,
  ref: Date = new Date(),
): Date | null {
  switch (recurrence) {
    case "hourly":
      return startOfLocalHour(ref);
    case "daily":
      return startOfLocalDay(ref);
    case "weekly":
      return startOfLocalWeek(ref);
    case "monthly":
      return startOfLocalMonth(ref);
    case "ad_hoc":
      return null;
    default:
      return startOfLocalDay(ref);
  }
}

export type StaffTodoCompletionTiming = {
  completed_at: string;
  reopened_at: string | null;
  staff_id: string;
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

/** Erledigt für aktuelle Periode (bei Wiederholung) bzw. insgesamt (ohne). */
export function isStaffTodoDoneForStaff(
  todo: {
    recurrence: StaffTodoRecurrence | null;
    completion_mode: "any_one" | "each_assignee";
  },
  completions: readonly StaffTodoCompletionTiming[],
  staffId: string,
  ref: Date = new Date(),
): boolean {
  const lastAt = latestActiveCompletionAt(completions, todo, staffId);
  if (!lastAt) return false;

  if (!todo.recurrence || todo.recurrence === "ad_hoc") {
    return true;
  }

  const periodStart = staffTodoPeriodStart(todo.recurrence, ref);
  if (!periodStart) return true;
  return new Date(lastAt) >= periodStart;
}

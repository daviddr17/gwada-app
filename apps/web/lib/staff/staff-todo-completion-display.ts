import { activeCompletionsInCurrentPeriod } from "@/lib/staff/staff-todo-due";
import {
  computeStaffTodoStatus,
  STAFF_TODO_STATUS_LABELS,
} from "@/lib/staff/staff-todo-status";
import {
  assignedPositionTagIds,
  assignedStaffIds,
} from "@/lib/staff/assignee-matching";
import {
  DEFAULT_RESTAURANT_TIMEZONE,
  formatRestaurantDateTime,
} from "@/lib/restaurant/restaurant-timezone";
import { staffDisplayName } from "@/lib/types/staff";
import type { RestaurantStaffRow } from "@/lib/types/staff";
import type {
  RestaurantStaffTodoCompletionRow,
  RestaurantStaffTodoRow,
} from "@/lib/types/staff-todos";

export function staffTodoAssigneeCount(todo: RestaurantStaffTodoRow): number {
  const staff = assignedStaffIds(todo).length;
  const positions = assignedPositionTagIds(todo).length;
  return Math.max(1, staff + positions);
}

export function resolveCompletionStaffName(
  completion: RestaurantStaffTodoCompletionRow,
  staffById?: ReadonlyMap<
    string,
    Pick<RestaurantStaffRow, "given_name" | "family_name">
  >,
): string {
  if (completion.staff) {
    return staffDisplayName({
      given_name: completion.staff.given_name,
      family_name: completion.staff.family_name ?? "",
    });
  }
  const fromList = staffById?.get(completion.staff_id);
  if (fromList) {
    return staffDisplayName({
      given_name: fromList.given_name,
      family_name: fromList.family_name ?? "",
    });
  }
  return "Unbekannt";
}

function formatCompletionWhen(iso: string, timeZone: string): string {
  return formatRestaurantDateTime(iso, timeZone);
}

export function formatStaffTodoStatusLabel(
  todo: RestaurantStaffTodoRow,
  timeZone: string = DEFAULT_RESTAURANT_TIMEZONE,
  staffById?: ReadonlyMap<
    string,
    Pick<RestaurantStaffRow, "given_name" | "family_name">
  >,
  ref: Date = new Date(),
): string {
  const assigneeCount = staffTodoAssigneeCount(todo);
  const status = computeStaffTodoStatus(
    todo,
    todo.completions,
    assigneeCount,
    ref,
    timeZone,
  );
  if (status === "partial") {
    const done = activeCompletionsInCurrentPeriod(
      todo,
      todo.completions ?? [],
      ref,
      timeZone,
    );
    const names = done
      .map((c) => resolveCompletionStaffName(c, staffById))
      .join(", ");
    return `${STAFF_TODO_STATUS_LABELS.partial} (${done.length}/${assigneeCount}: ${names})`;
  }
  if (status === "done") {
    const done = activeCompletionsInCurrentPeriod(
      todo,
      todo.completions ?? [],
      ref,
      timeZone,
    );
    if (done.length === 0) return STAFF_TODO_STATUS_LABELS.done;
    const latest = done.reduce((a, b) =>
      new Date(a.completed_at) > new Date(b.completed_at) ? a : b,
    );
    const who = resolveCompletionStaffName(latest, staffById);
    const when = formatCompletionWhen(latest.completed_at, timeZone);
    return `${STAFF_TODO_STATUS_LABELS.done} · ${who}, ${when}`;
  }
  return STAFF_TODO_STATUS_LABELS[status];
}

export function staffTodoCanReopen(
  todo: RestaurantStaffTodoRow,
  timeZone: string = DEFAULT_RESTAURANT_TIMEZONE,
  ref: Date = new Date(),
): boolean {
  const status = computeStaffTodoStatus(
    todo,
    todo.completions,
    staffTodoAssigneeCount(todo),
    ref,
    timeZone,
  );
  return status === "done" || status === "partial";
}

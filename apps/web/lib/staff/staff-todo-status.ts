import type {
  RestaurantStaffTodoCompletionRow,
  RestaurantStaffTodoRow,
  StaffTodoComputedStatus,
} from "@/lib/types/staff-todos";

function activeCompletions(
  completions: readonly RestaurantStaffTodoCompletionRow[] | undefined,
): RestaurantStaffTodoCompletionRow[] {
  if (!completions?.length) return [];
  return completions.filter((c) => !c.reopened_at);
}

export function computeStaffTodoStatus(
  todo: Pick<
    RestaurantStaffTodoRow,
    | "archived_at"
    | "display_from"
    | "display_until"
    | "completion_mode"
    | "assignee_type"
  >,
  completions: readonly RestaurantStaffTodoCompletionRow[] | undefined,
  assigneeCount = 1,
): StaffTodoComputedStatus {
  if (todo.archived_at) return "archived";

  const now = Date.now();
  if (todo.display_from) {
    const from = new Date(todo.display_from).getTime();
    if (!Number.isNaN(from) && from > now) return "planned";
  }

  const done = activeCompletions(completions);
  if (todo.completion_mode === "any_one") {
    if (done.length > 0) return "done";
  } else if (done.length >= Math.max(1, assigneeCount)) {
    return "done";
  } else if (done.length > 0) {
    return "partial";
  }

  if (todo.display_until) {
    const until = new Date(todo.display_until).getTime();
    if (!Number.isNaN(until) && until < now) return "overdue";
  }

  return "open";
}

export const STAFF_TODO_STATUS_LABELS: Record<StaffTodoComputedStatus, string> =
  {
    planned: "Geplant",
    open: "Offen",
    overdue: "Überfällig",
    partial: "Teilweise",
    done: "Erledigt",
    archived: "Archiviert",
  };

export function staffTodoStatusBadgeClass(status: StaffTodoComputedStatus): string {
  switch (status) {
    case "overdue":
      return "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300";
    case "done":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300";
    case "partial":
      return "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300";
    case "planned":
      return "border-sky-500/40 bg-sky-500/10 text-sky-800 dark:text-sky-300";
    case "archived":
      return "border-border/60 bg-muted/50 text-muted-foreground";
    default:
      return "border-border/60 bg-card text-foreground";
  }
}

export function staffTodoPriorityBadgeClass(
  priority: RestaurantStaffTodoRow["priority"],
): string {
  switch (priority) {
    case "high":
      return "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-300";
    case "low":
      return "border-border/60 bg-muted/30 text-muted-foreground";
    default:
      return "border-border/60 bg-card text-foreground";
  }
}

/** Display-Fußzeilen-Badge: grün / orange / rot (schlimmster offener ToDo). */
export type StaffTodoDisplayUrgency = "green" | "orange" | "red";

const DISPLAY_URGENCY_RANK: Record<StaffTodoDisplayUrgency, number> = {
  green: 0,
  orange: 1,
  red: 2,
};

export function staffTodoDisplayUrgency(
  todo: Pick<RestaurantStaffTodoRow, "priority">,
  status: StaffTodoComputedStatus,
): StaffTodoDisplayUrgency {
  if (status === "overdue") return "red";
  switch (todo.priority) {
    case "high":
      return "red";
    case "medium":
      return "orange";
    default:
      return "green";
  }
}

export function maxStaffTodoDisplayUrgency(
  urgencies: readonly StaffTodoDisplayUrgency[],
): StaffTodoDisplayUrgency {
  if (urgencies.length === 0) return "green";
  return urgencies.reduce((max, u) =>
    DISPLAY_URGENCY_RANK[u] > DISPLAY_URGENCY_RANK[max] ? u : max,
  );
}

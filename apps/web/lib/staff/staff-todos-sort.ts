import type { StaffTodoComputedStatus } from "@/lib/types/staff-todos";

export type StaffTodosSortKey =
  | "title"
  | "assignee"
  | "priority"
  | "status"
  | "due";

export type StaffTodosSortDir = "asc" | "desc";

export const STAFF_TODO_STATUS_SORT_ORDER: Record<StaffTodoComputedStatus, number> =
  {
    overdue: 0,
    open: 1,
    partial: 2,
    planned: 3,
    done: 4,
    archived: 5,
  };

export function defaultStaffTodosSortDir(key: StaffTodosSortKey): StaffTodosSortDir {
  switch (key) {
    case "title":
    case "assignee":
      return "asc";
    default:
      return "desc";
  }
}

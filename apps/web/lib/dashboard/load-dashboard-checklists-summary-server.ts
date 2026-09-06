import "server-only";

import type {
  DashboardChecklistsSummary,
  DashboardChecklistsTodoPreview,
} from "@/lib/dashboard/dashboard-module-summary-types";
import { DEFAULT_RESTAURANT_TIMEZONE } from "@/lib/restaurant/restaurant-timezone";
import { staffTodoAssigneeCount } from "@/lib/staff/staff-todo-completion-display";
import { computeStaffTodoStatus } from "@/lib/staff/staff-todo-status";
import { loadStaffTodoCompletionsByTodoId } from "@/lib/staff/staff-todos-status-load";
import type {
  RestaurantStaffTodoRow,
  StaffTodoPriority,
  StaffTodoRecurrence,
} from "@/lib/types/staff-todos";
import type { SupabaseClient } from "@supabase/supabase-js";

const DASHBOARD_TODO_SELECT = `
  id,
  title,
  priority,
  archived_at,
  display_from,
  display_until,
  completion_mode,
  recurrence,
  staff_id,
  position_tag_id,
  staff_assignees:restaurant_staff_todo_staff_assignees (
    staff_id
  ),
  position_assignees:restaurant_staff_todo_position_assignees (
    position_tag_id
  ),
  checklist_device:restaurant_checklist_devices (
    name
  ),
  checklist_area:restaurant_checklist_areas (
    name
  )
`;

type DashboardTodoRow = Pick<
  RestaurantStaffTodoRow,
  | "id"
  | "title"
  | "priority"
  | "archived_at"
  | "display_from"
  | "display_until"
  | "completion_mode"
  | "recurrence"
  | "staff_id"
  | "position_tag_id"
  | "staff_assignees"
  | "position_assignees"
> & {
  checklist_device?: { name: string } | null;
  checklist_area?: { name: string } | null;
};

function todoSortWeight(
  status: DashboardChecklistsTodoPreview["status"],
  priority: StaffTodoPriority,
): number {
  const priorityWeight =
    priority === "high" ? 0 : priority === "medium" ? 1 : 2;
  const statusWeight =
    status === "overdue" ? 0 : status === "open" ? 1 : status === "partial" ? 2 : 9;
  return statusWeight * 10 + priorityWeight;
}

/** Offene Checklisten-Todos inkl. Titel (Status-Engine wie im Modul). */
export async function loadDashboardChecklistsSummaryServer(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<DashboardChecklistsSummary> {
  // Completions nur ~48h Lookback — KPI braucht nur „heute“, nicht die volle History.
  const completionsSinceIso = new Date(
    Date.now() - 48 * 3_600_000,
  ).toISOString();

  const [{ data: tzRow }, { data: todoRows, error: todosError }, { data: completionRows }] =
    await Promise.all([
      sb
        .from("restaurants")
        .select("timezone")
        .eq("id", restaurantId)
        .maybeSingle(),
      sb
        .from("restaurant_staff_todos")
        .select(DASHBOARD_TODO_SELECT)
        .eq("restaurant_id", restaurantId)
        .is("archived_at", null),
      sb
        .from("restaurant_staff_todo_completions")
        .select("completed_at")
        .eq("restaurant_id", restaurantId)
        .not("completed_at", "is", null)
        .gte("completed_at", completionsSinceIso),
    ]);

  if (todosError) {
    console.error(
      "[gwada] dashboard checklists todos fetch",
      todosError.message,
    );
  }

  const timeZone =
    (tzRow as { timezone?: string | null } | null)?.timezone?.trim() ||
    DEFAULT_RESTAURANT_TIMEZONE;

  const todayYmd = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  let capturesToday = 0;
  for (const row of completionRows ?? []) {
    const completedAt = row.completed_at as string | null;
    if (!completedAt) continue;
    const ymd = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(completedAt));
    if (ymd === todayYmd) capturesToday += 1;
  }

  const todos = (todoRows ?? []) as unknown as DashboardTodoRow[];
  const completionsByTodoId = await loadStaffTodoCompletionsByTodoId(
    sb,
    restaurantId,
    todos.map((t) => ({
      id: t.id,
      recurrence: t.recurrence as StaffTodoRecurrence | null,
    })),
    { timeZone },
  );

  const now = new Date();
  const previews: DashboardChecklistsTodoPreview[] = [];

  for (const todo of todos) {
    const status = computeStaffTodoStatus(
      todo,
      completionsByTodoId.get(todo.id),
      staffTodoAssigneeCount(todo as RestaurantStaffTodoRow),
      now,
      timeZone,
    );
    if (status !== "open" && status !== "overdue" && status !== "partial") {
      continue;
    }
    previews.push({
      id: todo.id,
      title: todo.title?.trim() || "Aufgabe",
      status,
      priority: todo.priority,
      areaName: todo.checklist_area?.name?.trim() || null,
      deviceName: todo.checklist_device?.name?.trim() || null,
    });
  }

  previews.sort(
    (a, b) =>
      todoSortWeight(a.status, a.priority) - todoSortWeight(b.status, b.priority),
  );

  const overdueTodos = previews.filter((t) => t.status === "overdue").length;

  return {
    openTodos: previews.length,
    overdueTodos,
    capturesToday,
    todos: previews,
  };
}

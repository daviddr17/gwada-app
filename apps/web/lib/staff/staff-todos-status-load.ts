import type { SupabaseClient } from "@supabase/supabase-js";
import {
  groupCompletionsByTodoId,
  mapTodoCompletionsToCurrentPeriod,
  staffTodoCompletionLookbackIso,
} from "@/lib/staff/staff-todo-completions";
import type { StaffTodoRecurrence } from "@/lib/types/staff-todos";
import type { RestaurantStaffTodoCompletionRow } from "@/lib/types/staff-todos";
import { DEFAULT_RESTAURANT_TIMEZONE } from "@/lib/restaurant/restaurant-timezone";

const TODO_COMPLETION_FIELDS =
  "todo_id, staff_id, period_start, completed_at, reopened_at, completion_note, captured_numeric, captured_text, within_limits, corrective_action";

const TODO_COMPLETION_FIELDS_WITH_ID = `
  id,
  ${TODO_COMPLETION_FIELDS},
  confirmed_at,
  created_at,
  staff:restaurant_staff (
    id,
    given_name,
    family_name
  )
`;

const TODO_COMPLETION_FIELDS_LEGACY = `
  id,
  todo_id,
  staff_id,
  period_start,
  completed_at,
  reopened_at,
  confirmed_at,
  completion_note,
  created_at,
  staff:restaurant_staff (
    id,
    given_name,
    family_name
  )
`;

export async function loadStaffTodoCompletionsByTodoId(
  supabase: SupabaseClient,
  restaurantId: string,
  todos: readonly { id: string; recurrence: StaffTodoRecurrence | null }[],
  options?: {
    useLegacyFields?: boolean;
    timeZone?: string;
    ref?: Date;
  },
): Promise<Map<string, RestaurantStaffTodoCompletionRow[]>> {
  if (todos.length === 0) return new Map();

  const useLegacy = options?.useLegacyFields ?? false;
  const timeZone = options?.timeZone ?? DEFAULT_RESTAURANT_TIMEZONE;
  const ref = options?.ref ?? new Date();
  const todoIds = todos.map((t) => t.id);
  const lookbackIso = staffTodoCompletionLookbackIso(todos.map((t) => t.recurrence));

  const { data: completions, error } = await supabase
    .from("restaurant_staff_todo_completions")
    .select(
      useLegacy ? TODO_COMPLETION_FIELDS_LEGACY : TODO_COMPLETION_FIELDS_WITH_ID,
    )
    .in("todo_id", [...todoIds])
    .gte("period_start", lookbackIso);

  if (error) {
    console.error("[gwada] staff todo completions fetch", error.message);
    return new Map();
  }

  const byTodo = groupCompletionsByTodoId(
    (completions ?? []) as unknown as RestaurantStaffTodoCompletionRow[],
  );

  return mapTodoCompletionsToCurrentPeriod(
    todos,
    byTodo,
    ref,
    timeZone,
  );
}

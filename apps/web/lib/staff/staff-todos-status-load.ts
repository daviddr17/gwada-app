import type { SupabaseClient } from "@supabase/supabase-js";
import {
  groupCompletionsByTodoId,
  mapTodoCompletionsToCurrentPeriod,
  staffTodoCompletionLookbackIso,
} from "@/lib/staff/staff-todo-completions";
import { STAFF_TODO_AD_HOC_PERIOD_START } from "@/lib/staff/staff-todo-due";
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

function isAdHocTodoRecurrence(
  recurrence: StaffTodoRecurrence | null | undefined,
): boolean {
  return !recurrence || recurrence === "ad_hoc";
}

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
  const lookbackIso = staffTodoCompletionLookbackIso(
    todos.map((t) => t.recurrence),
    ref,
  );
  const selectFields = useLegacy
    ? TODO_COMPLETION_FIELDS_LEGACY
    : TODO_COMPLETION_FIELDS_WITH_ID;
  const includeAdHoc = todos.some((t) => isAdHocTodoRecurrence(t.recurrence));

  /**
   * Einmalige / ad_hoc Completions speichern `period_start = 1970-01-01…`.
   * Ein reines `.gte(period_start, lookback)` würde sie immer aussieben —
   * Erledigung ist dann in der DB, UI/Display zeigen die ToDo wieder als offen.
   */
  const recentQuery = supabase
    .from("restaurant_staff_todo_completions")
    .select(selectFields)
    .in("todo_id", [...todoIds])
    .gte("period_start", lookbackIso);

  const adHocQuery = includeAdHoc
    ? supabase
        .from("restaurant_staff_todo_completions")
        .select(selectFields)
        .in("todo_id", [...todoIds])
        .eq("period_start", STAFF_TODO_AD_HOC_PERIOD_START)
    : null;

  const [recentRes, adHocRes] = await Promise.all([
    recentQuery,
    adHocQuery,
  ]);

  if (recentRes.error) {
    console.error(
      "[gwada] staff todo completions fetch",
      recentRes.error.message,
    );
    return new Map();
  }
  if (adHocRes?.error) {
    console.error(
      "[gwada] staff todo ad-hoc completions fetch",
      adHocRes.error.message,
    );
    return new Map();
  }

  const merged = [
    ...((recentRes.data ??
      []) as unknown as RestaurantStaffTodoCompletionRow[]),
    ...((adHocRes?.data ??
      []) as unknown as RestaurantStaffTodoCompletionRow[]),
  ];

  const byTodo = groupCompletionsByTodoId(merged);

  return mapTodoCompletionsToCurrentPeriod(todos, byTodo, ref, timeZone);
}

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  StaffTodoDeferTrigger,
  StaffTodoLogAction,
  RestaurantStaffTodoCompletionRow,
} from "@/lib/types/staff-todos";
import { computeStaffTodoStatus } from "@/lib/staff/staff-todo-status";
import {
  maxStaffTodoDisplayUrgency,
  staffTodoDisplayUrgency,
  type StaffTodoDisplayUrgency,
} from "@/lib/staff/staff-todo-status";
import type { DisplayTodosLiveSignal } from "@/lib/staff/display-todos-live-signal";
import {
  displayActionToTrigger,
  triggerShowColumn,
} from "@/lib/staff/staff-todo-display-triggers";

export { displayActionToTrigger } from "@/lib/staff/staff-todo-display-triggers";

type TodoRow = {
  id: string;
  restaurant_id: string;
  title: string;
  description: string | null;
  assignee_type: "staff" | "position_tag";
  staff_id: string | null;
  position_tag_id: string | null;
  priority: "high" | "medium" | "low";
  display_from: string | null;
  display_until: string | null;
  show_on_display: boolean;
  show_before_clock_in: boolean;
  show_before_break_start: boolean;
  show_before_break_end: boolean;
  show_before_clock_out: boolean;
  show_on_pin_login: boolean;
  allow_reopen_on_display: boolean;
  completion_mode: "any_one" | "each_assignee";
  require_defer_reason: boolean;
  blocks_shift_end: boolean;
  archived_at: string | null;
  updated_at: string;
};

type CompletionRow = {
  todo_id: string;
  staff_id: string;
  completed_at: string;
  reopened_at: string | null;
};

type DeferralRow = {
  id: string;
  todo_id: string;
  staff_id: string;
  trigger_type: StaffTodoDeferTrigger;
  reason: string | null;
  deferred_at: string;
  cleared_at: string | null;
};

const TODO_SELECT = `
  id,
  restaurant_id,
  title,
  description,
  assignee_type,
  staff_id,
  position_tag_id,
  priority,
  display_from,
  display_until,
  show_on_display,
  show_before_clock_in,
  show_before_break_start,
  show_before_break_end,
  show_before_clock_out,
  show_on_pin_login,
  allow_reopen_on_display,
  completion_mode,
  require_defer_reason,
  blocks_shift_end,
  archived_at,
  updated_at
`;

export type { DisplayTodosLiveSignal } from "@/lib/staff/display-todos-live-signal";

export type DisplayTodoItem = TodoRow & {
  status: ReturnType<typeof computeStaffTodoStatus>;
  completions: RestaurantStaffTodoCompletionRow[];
  active_deferral: DeferralRow | null;
};

export type DisplayTodoClientItem = DisplayTodoItem & {
  done_for_staff: boolean;
};

export function mapDisplayTodoForClient(
  item: DisplayTodoItem,
  staffId: string,
): DisplayTodoClientItem {
  return {
    ...item,
    done_for_staff: isTodoDoneForStaff(item, item.completions, staffId),
  };
}

export function isVisibleInDisplayTodoList(item: DisplayTodoClientItem): boolean {
  if (item.status === "archived" || item.status === "planned") return false;
  if (!item.done_for_staff) return true;
  return item.allow_reopen_on_display;
}

async function loadStaffPositionTagId(
  admin: SupabaseClient,
  staffId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("restaurant_staff")
    .select("position_tag_id")
    .eq("id", staffId)
    .maybeSingle();
  return (data as { position_tag_id: string | null } | null)?.position_tag_id ?? null;
}

function todoAssignedToStaff(
  todo: TodoRow,
  staffId: string,
  positionTagId: string | null,
): boolean {
  if (todo.assignee_type === "staff") return todo.staff_id === staffId;
  if (todo.assignee_type === "position_tag") {
    return positionTagId != null && todo.position_tag_id === positionTagId;
  }
  return false;
}

async function fetchStaffTodoRows(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<TodoRow[]> {
  const { data, error } = await admin
    .from("restaurant_staff_todos")
    .select(TODO_SELECT)
    .eq("restaurant_id", restaurantId)
    .is("archived_at", null);

  if (error) {
    console.warn("[gwada] display todos fetch", error.message);
    return [];
  }

  return (data ?? []) as TodoRow[];
}

/** Badge + ToDo-Sheet — nur `show_on_display`. */
async function fetchAssignableTodos(
  admin: SupabaseClient,
  restaurantId: string,
  staffId: string,
  positionTagId: string | null,
): Promise<TodoRow[]> {
  const rows = await fetchStaffTodoRows(admin, restaurantId);
  return rows.filter(
    (t) => t.show_on_display && todoAssignedToStaff(t, staffId, positionTagId),
  );
}

/** Schicht-Popups — unabhängig von `show_on_display`, nur Trigger-Flags am ToDo. */
async function fetchTriggerTodos(
  admin: SupabaseClient,
  restaurantId: string,
  staffId: string,
  positionTagId: string | null,
  trigger: StaffTodoDeferTrigger,
): Promise<TodoRow[]> {
  const col = triggerShowColumn(trigger);
  const rows = await fetchStaffTodoRows(admin, restaurantId);
  return rows.filter(
    (t) => t[col] && todoAssignedToStaff(t, staffId, positionTagId),
  );
}

async function loadCompletionsForTodos(
  admin: SupabaseClient,
  todoIds: string[],
): Promise<Map<string, CompletionRow[]>> {
  if (todoIds.length === 0) return new Map();
  const { data } = await admin
    .from("restaurant_staff_todo_completions")
    .select("todo_id, staff_id, completed_at, reopened_at")
    .in("todo_id", todoIds);

  const map = new Map<string, CompletionRow[]>();
  for (const row of (data ?? []) as CompletionRow[]) {
    const list = map.get(row.todo_id) ?? [];
    list.push(row);
    map.set(row.todo_id, list);
  }
  return map;
}

async function loadActiveDeferrals(
  admin: SupabaseClient,
  staffId: string,
  todoIds: string[],
): Promise<Map<string, DeferralRow>> {
  if (todoIds.length === 0) return new Map();
  const { data } = await admin
    .from("restaurant_staff_todo_deferrals")
    .select("id, todo_id, staff_id, trigger_type, reason, deferred_at, cleared_at")
    .eq("staff_id", staffId)
    .in("todo_id", todoIds)
    .is("cleared_at", null);

  const map = new Map<string, DeferralRow>();
  for (const row of (data ?? []) as DeferralRow[]) {
    map.set(row.todo_id, row);
  }
  return map;
}

function isTodoDoneForStaff(
  todo: TodoRow,
  completions: RestaurantStaffTodoCompletionRow[],
  staffId: string,
): boolean {
  const active = completions.filter((c) => !c.reopened_at);
  if (todo.completion_mode === "any_one") return active.length > 0;
  return active.some((c) => c.staff_id === staffId);
}

function enrichTodo(
  todo: TodoRow,
  completions: RestaurantStaffTodoCompletionRow[],
  deferral: DeferralRow | null,
): DisplayTodoItem {
  return {
    ...todo,
    completions,
    active_deferral: deferral,
    status: computeStaffTodoStatus(todo, completions),
  };
}

export async function listDisplayTodosForStaff(
  admin: SupabaseClient,
  params: { restaurantId: string; staffId: string },
): Promise<DisplayTodoItem[]> {
  const positionTagId = await loadStaffPositionTagId(admin, params.staffId);
  const todos = await fetchAssignableTodos(
    admin,
    params.restaurantId,
    params.staffId,
    positionTagId,
  );
  const ids = todos.map((t) => t.id);
  const [completionsMap, deferralsMap] = await Promise.all([
    loadCompletionsForTodos(admin, ids),
    loadActiveDeferrals(admin, params.staffId, ids),
  ]);

  return todos.map((t) =>
    enrichTodo(
      t,
      (completionsMap.get(t.id) ?? []) as RestaurantStaffTodoCompletionRow[],
      deferralsMap.get(t.id) ?? null,
    ),
  );
}

export async function getDisplayTodoBadgeSummary(
  admin: SupabaseClient,
  params: { restaurantId: string; staffId: string },
): Promise<{ count: number; urgency: StaffTodoDisplayUrgency }> {
  const items = await listDisplayTodosForStaff(admin, params);
  const open = items.filter(
    (t) =>
      !isTodoDoneForStaff(t, t.completions, params.staffId) &&
      t.status !== "planned" &&
      t.status !== "archived",
  );
  return {
    count: open.length,
    urgency: maxStaffTodoDisplayUrgency(
      open.map((t) => staffTodoDisplayUrgency(t, t.status)),
    ),
  };
}

export async function getDisplayTodoBadgeCount(
  admin: SupabaseClient,
  params: { restaurantId: string; staffId: string },
): Promise<number> {
  const summary = await getDisplayTodoBadgeSummary(admin, params);
  return summary.count;
}

/** Leichtgewichtiges Polling-Signal für Display (ohne Supabase-Realtime). */
export async function loadDisplayTodosLiveSignal(
  admin: SupabaseClient,
  params: { restaurantId: string; staffId: string },
): Promise<DisplayTodosLiveSignal> {
  const summary = await getDisplayTodoBadgeSummary(admin, params);
  const positionTagId = await loadStaffPositionTagId(admin, params.staffId);
  const todos = await fetchAssignableTodos(
    admin,
    params.restaurantId,
    params.staffId,
    positionTagId,
  );

  let maxMs = 0;
  const bump = (iso: string | null | undefined) => {
    if (!iso) return;
    const t = new Date(iso).getTime();
    if (!Number.isNaN(t) && t > maxMs) maxMs = t;
  };

  for (const t of todos) bump(t.updated_at);

  const ids = todos.map((t) => t.id);
  if (ids.length > 0) {
    const [{ data: completions }, { data: deferrals }] = await Promise.all([
      admin
        .from("restaurant_staff_todo_completions")
        .select("completed_at, reopened_at")
        .in("todo_id", ids)
        .eq("staff_id", params.staffId),
      admin
        .from("restaurant_staff_todo_deferrals")
        .select("deferred_at, cleared_at")
        .in("todo_id", ids)
        .eq("staff_id", params.staffId),
    ]);
    for (const row of completions ?? []) {
      bump(row.completed_at);
      bump(row.reopened_at);
    }
    for (const row of deferrals ?? []) {
      bump(row.deferred_at);
      bump(row.cleared_at);
    }
  }

  const minuteBucket = Math.floor(Date.now() / 60_000);
  return {
    revision: `${summary.count}|${summary.urgency}|${maxMs}|${minuteBucket}`,
  };
}

export async function clearDeferralsForTrigger(
  admin: SupabaseClient,
  params: { staffId: string; trigger: StaffTodoDeferTrigger },
): Promise<void> {
  await admin
    .from("restaurant_staff_todo_deferrals")
    .update({ cleared_at: new Date().toISOString() })
    .eq("staff_id", params.staffId)
    .eq("trigger_type", params.trigger)
    .is("cleared_at", null);
}

export async function getTodosForDisplayTrigger(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    staffId: string;
    trigger: StaffTodoDeferTrigger;
    prepareTrigger?: boolean;
  },
): Promise<DisplayTodoItem[]> {
  if (params.prepareTrigger) {
    await clearDeferralsForTrigger(admin, {
      staffId: params.staffId,
      trigger: params.trigger,
    });
  }

  const positionTagId = await loadStaffPositionTagId(admin, params.staffId);
  const todos = await fetchTriggerTodos(
    admin,
    params.restaurantId,
    params.staffId,
    positionTagId,
    params.trigger,
  );
  const ids = todos.map((t) => t.id);
  const [completionsMap, deferralsMap] = await Promise.all([
    loadCompletionsForTodos(admin, ids),
    loadActiveDeferrals(admin, params.staffId, ids),
  ]);

  return todos
    .map((t) =>
      enrichTodo(
        t,
        (completionsMap.get(t.id) ?? []) as RestaurantStaffTodoCompletionRow[],
        deferralsMap.get(t.id) ?? null,
      ),
    )
    .filter((t) => {
      if (isTodoDoneForStaff(t, t.completions, params.staffId)) return false;
      if (t.status === "planned" || t.status === "archived") return false;
      if (t.active_deferral?.trigger_type === params.trigger) return false;
      return true;
    });
}

export async function completeDisplayTodo(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    staffId: string;
    todoId: string;
    completedByStaffId: string;
  },
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const { data: todo } = await admin
    .from("restaurant_staff_todos")
    .select("id, restaurant_id, title")
    .eq("id", params.todoId)
    .eq("restaurant_id", params.restaurantId)
    .is("archived_at", null)
    .maybeSingle();

  if (!todo) {
    return { ok: false, error: "not_found", status: 404 };
  }

  const now = new Date().toISOString();
  const { error: compErr } = await admin
    .from("restaurant_staff_todo_completions")
    .upsert(
      {
        todo_id: params.todoId,
        staff_id: params.completedByStaffId,
        completed_at: now,
        reopened_at: null,
        confirmed_at: now,
      },
      { onConflict: "todo_id,staff_id" },
    );

  if (compErr) {
    return { ok: false, error: compErr.message, status: 500 };
  }

  await admin.from("restaurant_staff_todo_log_entries").insert({
    restaurant_id: params.restaurantId,
    todo_id: params.todoId,
    action: "completed" satisfies StaffTodoLogAction,
    actor_staff_id: params.staffId,
    details: { title: (todo as { title: string }).title },
  });

  return { ok: true };
}

export async function reopenDisplayTodo(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    staffId: string;
    todoId: string;
  },
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const { data: todo } = await admin
    .from("restaurant_staff_todos")
    .select("id, restaurant_id, title, allow_reopen_on_display")
    .eq("id", params.todoId)
    .eq("restaurant_id", params.restaurantId)
    .is("archived_at", null)
    .maybeSingle();

  if (!todo) {
    return { ok: false, error: "not_found", status: 404 };
  }

  const row = todo as {
    title: string;
    allow_reopen_on_display: boolean;
  };

  if (!row.allow_reopen_on_display) {
    return { ok: false, error: "reopen_not_allowed", status: 403 };
  }

  const now = new Date().toISOString();
  const { data: completion, error: loadErr } = await admin
    .from("restaurant_staff_todo_completions")
    .select("id, reopened_at")
    .eq("todo_id", params.todoId)
    .eq("staff_id", params.staffId)
    .is("reopened_at", null)
    .maybeSingle();

  if (loadErr) {
    return { ok: false, error: loadErr.message, status: 500 };
  }
  if (!completion) {
    return { ok: false, error: "not_completed", status: 409 };
  }

  const { error: updateErr } = await admin
    .from("restaurant_staff_todo_completions")
    .update({ reopened_at: now })
    .eq("id", (completion as { id: string }).id);

  if (updateErr) {
    return { ok: false, error: updateErr.message, status: 500 };
  }

  await admin.from("restaurant_staff_todo_log_entries").insert({
    restaurant_id: params.restaurantId,
    todo_id: params.todoId,
    action: "reopened" satisfies StaffTodoLogAction,
    actor_staff_id: params.staffId,
    details: { title: row.title },
  });

  return { ok: true };
}

export async function deferDisplayTodo(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    staffId: string;
    todoId: string;
    trigger: StaffTodoDeferTrigger;
    reason?: string | null;
  },
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const { data: todo } = await admin
    .from("restaurant_staff_todos")
    .select("id, restaurant_id, title, require_defer_reason")
    .eq("id", params.todoId)
    .eq("restaurant_id", params.restaurantId)
    .is("archived_at", null)
    .maybeSingle();

  if (!todo) {
    return { ok: false, error: "not_found", status: 404 };
  }

  const row = todo as {
    title: string;
    require_defer_reason: boolean;
  };

  if (row.require_defer_reason && !params.reason?.trim()) {
    return { ok: false, error: "reason_required", status: 400 };
  }

  const { error: defErr } = await admin
    .from("restaurant_staff_todo_deferrals")
    .insert({
      todo_id: params.todoId,
      staff_id: params.staffId,
      trigger_type: params.trigger,
      reason: params.reason?.trim() || null,
    });

  if (defErr) {
    return { ok: false, error: defErr.message, status: 500 };
  }

  await admin.from("restaurant_staff_todo_log_entries").insert({
    restaurant_id: params.restaurantId,
    todo_id: params.todoId,
    action: "deferred" satisfies StaffTodoLogAction,
    actor_staff_id: params.staffId,
    details: {
      title: row.title,
      trigger: params.trigger,
      reason: params.reason?.trim() || null,
    },
  });

  return { ok: true };
}

export function displayTriggerBlocksProceed(
  todos: DisplayTodoItem[],
  trigger: StaffTodoDeferTrigger,
): boolean {
  return todos.some(
    (t) => t.blocks_shift_end && trigger === "clock_out",
  );
}

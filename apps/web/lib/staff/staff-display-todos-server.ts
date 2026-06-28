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
import { isAssignedToStaffMember } from "@/lib/staff/assignee-matching";
function displayTodoAssigneeCount(todo: TodoRow): number {
  const staff =
    (todo.staff_assignees ?? []).length > 0
      ? (todo.staff_assignees ?? []).length
      : todo.staff_id
        ? 1
        : 0;
  const positions =
    (todo.position_assignees ?? []).length > 0
      ? (todo.position_assignees ?? []).length
      : todo.position_tag_id
        ? 1
        : 0;
  return Math.max(1, staff + positions);
}
import {
  evaluateStaffTodoCapture,
  type StaffTodoCapturePayload,
} from "@/lib/staff/staff-todo-capture";
import {
  loadStaffTodoCompletionsByTodoId,
} from "@/lib/staff/staff-todos-status-load";
import { DEFAULT_RESTAURANT_TIMEZONE } from "@/lib/restaurant/restaurant-timezone";
import {
  isStaffTodoDoneForStaff,
  staffTodoPeriodStartIsoForStorage,
} from "@/lib/staff/staff-todo-due";
import type {
  StaffTodoCaptureType,
  StaffTodoRecurrence,
  StaffTodoPriority,
} from "@/lib/types/staff-todos";

export class DisplayTodosFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DisplayTodosFetchError";
  }
}

const STAFF_TODO_PRIORITY_RANK: Record<StaffTodoPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export { displayActionToTrigger } from "@/lib/staff/staff-todo-display-triggers";

type TodoRow = {
  id: string;
  restaurant_id: string;
  title: string;
  description: string | null;
  assignee_type: "staff" | "position_tag" | "mixed" | null;
  staff_id: string | null;
  position_tag_id: string | null;
  staff_assignees?: { staff_id: string }[];
  position_assignees?: { position_tag_id: string }[];
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
  recurrence: StaffTodoRecurrence | null;
  capture_type: StaffTodoCaptureType;
  target_min: number | null;
  target_max: number | null;
  checklist_device_id: string | null;
  checklist_area_id: string | null;
  require_corrective_on_deviation: boolean;
  checklist_device?: {
    id: string;
    name: string;
    area_id: string | null;
    target_min: number | null;
    target_max: number | null;
  } | null;
  checklist_area?: {
    id: string;
    name: string;
    background_color: string;
  } | null;
};

type CompletionRow = {
  todo_id: string;
  staff_id: string;
  completed_at: string;
  reopened_at: string | null;
  completion_note: string | null;
  captured_numeric: number | null;
  captured_text: string | null;
  within_limits: boolean | null;
  corrective_action: string | null;
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
  staff_assignees:restaurant_staff_todo_staff_assignees ( staff_id ),
  position_assignees:restaurant_staff_todo_position_assignees ( position_tag_id ),
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
  updated_at,
  recurrence,
  capture_type,
  target_min,
  target_max,
  checklist_device_id,
  checklist_area_id,
  require_corrective_on_deviation,
  checklist_device:restaurant_checklist_devices (
    id,
    name,
    area_id,
    target_min,
    target_max
  ),
  checklist_area:restaurant_checklist_areas (
    id,
    name,
    background_color
  )
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

/** Schlanke API-Antwort für Display-UI (Popups, Badge, Checklisten-Modul). */
export type DisplayTodoClientPayload = {
  id: string;
  title: string;
  description: string | null;
  priority: TodoRow["priority"];
  require_defer_reason: boolean;
  blocks_shift_end: boolean;
  allow_reopen_on_display: boolean;
  recurrence: StaffTodoRecurrence | null;
  capture_type: StaffTodoCaptureType;
  target_min: number | null;
  target_max: number | null;
  require_corrective_on_deviation: boolean;
  checklist_area: TodoRow["checklist_area"];
  checklist_device: TodoRow["checklist_device"];
  status: DisplayTodoItem["status"];
  done_for_staff: boolean;
  captured_numeric: number | null;
  captured_text: string | null;
  completion_note: string | null;
  within_limits: boolean | null;
  corrective_action: string | null;
};

export function mapDisplayTodoClientPayload(
  item: DisplayTodoItem,
  staffId: string,
  timeZone: string = DEFAULT_RESTAURANT_TIMEZONE,
): DisplayTodoClientPayload {
  const done_for_staff = isStaffTodoDoneForStaff(
    item,
    item.completions,
    staffId,
    new Date(),
    timeZone,
  );
  const activeCompletion = activeCompletionForDisplayStaff(
    item,
    item.completions,
    staffId,
  );
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    priority: item.priority,
    require_defer_reason: item.require_defer_reason,
    blocks_shift_end: item.blocks_shift_end,
    allow_reopen_on_display: item.allow_reopen_on_display,
    recurrence: item.recurrence,
    capture_type: item.capture_type ?? "none",
    target_min: item.target_min,
    target_max: item.target_max,
    require_corrective_on_deviation: item.require_corrective_on_deviation,
    checklist_area: item.checklist_area ?? null,
    checklist_device: item.checklist_device ?? null,
    status: item.status,
    done_for_staff,
    captured_numeric: activeCompletion?.captured_numeric ?? null,
    captured_text: activeCompletion?.captured_text ?? null,
    completion_note: activeCompletion?.completion_note ?? null,
    within_limits: activeCompletion?.within_limits ?? null,
    corrective_action: activeCompletion?.corrective_action ?? null,
  };
}

function activeCompletionForDisplayStaff(
  todo: Pick<TodoRow, "completion_mode">,
  completions: readonly RestaurantStaffTodoCompletionRow[],
  staffId: string,
): RestaurantStaffTodoCompletionRow | null {
  const active = completions.filter((c) => !c.reopened_at);
  if (active.length === 0) return null;
  if (todo.completion_mode === "each_assignee") {
    return active.find((c) => c.staff_id === staffId) ?? null;
  }
  return active.find((c) => c.staff_id === staffId) ?? active[0] ?? null;
}

export function mapDisplayTodoForClient(
  item: DisplayTodoItem,
  staffId: string,
  timeZone: string = DEFAULT_RESTAURANT_TIMEZONE,
): DisplayTodoClientItem {
  return {
    ...item,
    done_for_staff: isStaffTodoDoneForStaff(
      item,
      item.completions,
      staffId,
      new Date(),
      timeZone,
    ),
  };
}

export function isVisibleInDisplayTodoList(item: DisplayTodoClientItem): boolean {
  if (item.status === "archived" || item.status === "planned") return false;
  if (!item.done_for_staff) return true;
  return item.allow_reopen_on_display;
}

function isDisplayTodoOpenForStaff(
  item: DisplayTodoItem,
  staffId: string,
  timeZone: string,
): boolean {
  return !isTodoDoneForStaff(
    item,
    item.completions,
    staffId,
    timeZone,
  );
}

export function countDisplayTodosForBadge(
  items: DisplayTodoItem[],
  staffId: string,
  timeZone: string = DEFAULT_RESTAURANT_TIMEZONE,
): {
  count: number;
  openItems: DisplayTodoItem[];
  reopenableDoneItems: DisplayTodoItem[];
} {
  const visible = items.filter((t) => {
    const enriched = {
      ...t,
      done_for_staff: isTodoDoneForStaff(
        t,
        t.completions,
        staffId,
        timeZone,
      ),
    } as DisplayTodoClientItem;
    return isVisibleInDisplayTodoList(enriched);
  });
  const openItems = visible.filter((t) =>
    isDisplayTodoOpenForStaff(t, staffId, timeZone),
  );
  const reopenableDoneItems = visible.filter(
    (t) =>
      !isDisplayTodoOpenForStaff(t, staffId, timeZone) &&
      t.allow_reopen_on_display,
  );
  const count = openItems.filter(
    (t) => t.status !== "planned" && t.status !== "archived",
  ).length;
  return { count, openItems, reopenableDoneItems };
}

async function assertDisplayTodoAssignedToStaff(
  admin: SupabaseClient,
  params: { restaurantId: string; staffId: string; todoId: string },
  select: string,
): Promise<
  | { ok: true; row: TodoRow }
  | { ok: false; error: string; status: number }
> {
  const positionTagId = await loadStaffPositionTagId(admin, params.staffId);
  const { data: todo } = await admin
    .from("restaurant_staff_todos")
    .select(select)
    .eq("id", params.todoId)
    .eq("restaurant_id", params.restaurantId)
    .is("archived_at", null)
    .maybeSingle();

  if (!todo) {
    return { ok: false, error: "not_found", status: 404 };
  }

  const row =
    select === TODO_SELECT
      ? normalizeDisplayTodoRow(todo as unknown as Record<string, unknown>)
      : (todo as unknown as TodoRow);

  if (!todoAssignedToStaff(row, params.staffId, positionTagId)) {
    return { ok: false, error: "not_assigned", status: 403 };
  }

  return { ok: true, row };
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
  return isAssignedToStaffMember(todo, staffId, positionTagId, {
    emptyMeansAll: false,
  });
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
    console.error("[gwada] display todos fetch", error.message);
    throw new DisplayTodosFetchError(error.message);
  }

  return ((data ?? []) as Record<string, unknown>[]).map(normalizeDisplayTodoRow);
}

function normalizeDisplayTodoRow(raw: Record<string, unknown>): TodoRow {
  const device = raw.checklist_device;
  const area = raw.checklist_area;
  return {
    ...(raw as unknown as TodoRow),
    checklist_device: Array.isArray(device)
      ? ((device[0] as TodoRow["checklist_device"]) ?? null)
      : ((device as TodoRow["checklist_device"]) ?? null),
    checklist_area: Array.isArray(area)
      ? ((area[0] as TodoRow["checklist_area"]) ?? null)
      : ((area as TodoRow["checklist_area"]) ?? null),
  };
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

export async function loadDisplayRestaurantTimezone(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<string> {
  return loadRestaurantTimezone(admin, restaurantId);
}

async function loadRestaurantTimezone(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<string> {
  const { data } = await admin
    .from("restaurants")
    .select("timezone")
    .eq("id", restaurantId)
    .maybeSingle();
  const tz =
    typeof (data as { timezone?: string } | null)?.timezone === "string"
      ? (data as { timezone: string }).timezone.trim()
      : "";
  return tz || DEFAULT_RESTAURANT_TIMEZONE;
}

async function loadCompletionsForTodos(
  admin: SupabaseClient,
  restaurantId: string,
  todos: Pick<TodoRow, "id" | "recurrence">[],
  timeZone: string,
): Promise<Map<string, CompletionRow[]>> {
  return loadStaffTodoCompletionsByTodoId(admin, restaurantId, todos, {
    timeZone,
  });
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
  timeZone: string = DEFAULT_RESTAURANT_TIMEZONE,
): boolean {
  return isStaffTodoDoneForStaff(
    todo,
    completions,
    staffId,
    new Date(),
    timeZone,
  );
}

function enrichTodo(
  todo: TodoRow,
  completions: RestaurantStaffTodoCompletionRow[],
  deferral: DeferralRow | null,
  timeZone: string,
): DisplayTodoItem {
  return {
    ...todo,
    completions,
    active_deferral: deferral,
    status: computeStaffTodoStatus(
      todo,
      completions,
      displayTodoAssigneeCount(todo),
      new Date(),
      timeZone,
    ),
  };
}

export async function listDisplayTodosForStaff(
  admin: SupabaseClient,
  params: { restaurantId: string; staffId: string },
): Promise<DisplayTodoItem[]> {
  const [positionTagId, timeZone] = await Promise.all([
    loadStaffPositionTagId(admin, params.staffId),
    loadRestaurantTimezone(admin, params.restaurantId),
  ]);
  const todos = await fetchAssignableTodos(
    admin,
    params.restaurantId,
    params.staffId,
    positionTagId,
  );
  const todoIds = todos.map((t) => t.id);
  const [completionsMap, deferralsMap] = await Promise.all([
    loadCompletionsForTodos(admin, params.restaurantId, todos, timeZone),
    loadActiveDeferrals(admin, params.staffId, todoIds),
  ]);

  return todos.map((t) =>
    enrichTodo(
      t,
      (completionsMap.get(t.id) ?? []) as RestaurantStaffTodoCompletionRow[],
      deferralsMap.get(t.id) ?? null,
      timeZone,
    ),
  );
}

export async function getDisplayTodoBadgeSummary(
  admin: SupabaseClient,
  params: { restaurantId: string; staffId: string },
): Promise<{ count: number; urgency: StaffTodoDisplayUrgency }> {
  const [, timeZone] = await Promise.all([
    loadStaffPositionTagId(admin, params.staffId),
    loadRestaurantTimezone(admin, params.restaurantId),
  ]);
  const items = await listDisplayTodosForStaff(admin, params);
  const { count, openItems, reopenableDoneItems } = countDisplayTodosForBadge(
    items,
    params.staffId,
    timeZone,
  );
  const open = openItems.filter(
    (t) => t.status !== "planned" && t.status !== "archived",
  );
  const urgencySource =
    open.length > 0
      ? open
      : reopenableDoneItems.filter(
          (t) => t.status !== "planned" && t.status !== "archived",
        );
  return {
    count,
    urgency: maxStaffTodoDisplayUrgency(
      urgencySource.map((t) => staffTodoDisplayUrgency(t, t.status)),
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
  return {
    revision: `${summary.count}|${summary.urgency}`,
  };
}

async function clearDeferralsForTodo(
  admin: SupabaseClient,
  params: { staffId: string; todoId: string },
): Promise<void> {
  await admin
    .from("restaurant_staff_todo_deferrals")
    .update({ cleared_at: new Date().toISOString() })
    .eq("staff_id", params.staffId)
    .eq("todo_id", params.todoId)
    .is("cleared_at", null);
}

async function clearDeferralsForTrigger(
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

export async function fetchStaffTodoDeferReasonDefault(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("restaurant_staff_todo_settings")
    .select("defer_reason_default")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  const text =
    typeof data?.defer_reason_default === "string"
      ? data.defer_reason_default.trim()
      : "";
  return text || null;
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
  const timeZone = await loadRestaurantTimezone(admin, params.restaurantId);
  const ids = todos.map((t) => t.id);
  const [completionsMap, deferralsMap] = await Promise.all([
    loadCompletionsForTodos(admin, params.restaurantId, todos, timeZone),
    loadActiveDeferrals(admin, params.staffId, ids),
  ]);

  return todos
    .map((t) =>
      enrichTodo(
        t,
        (completionsMap.get(t.id) ?? []) as RestaurantStaffTodoCompletionRow[],
        deferralsMap.get(t.id) ?? null,
        timeZone,
      ),
    )
    .filter((t) => {
      if (
        isTodoDoneForStaff(
          t,
          t.completions,
          params.staffId,
          timeZone,
        )
      ) {
        return false;
      }
      if (t.status === "planned" || t.status === "archived") return false;
      if (t.active_deferral?.trigger_type === params.trigger) return false;
      return true;
    })
    .sort(
      (a, b) =>
        STAFF_TODO_PRIORITY_RANK[a.priority] -
        STAFF_TODO_PRIORITY_RANK[b.priority],
    );
}

export async function completeDisplayTodo(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    staffId: string;
    todoId: string;
    completedByStaffId: string;
    completionNote?: string | null;
    capture?: StaffTodoCapturePayload;
  },
): Promise<
  | { ok: true; todo_done_for_staff: boolean }
  | { ok: false; error: string; status: number }
> {
  const assigned = await assertDisplayTodoAssignedToStaff(
    admin,
    {
      restaurantId: params.restaurantId,
      staffId: params.staffId,
      todoId: params.todoId,
    },
    TODO_SELECT,
  );
  if (!assigned.ok) {
    return assigned;
  }

  const row = assigned.row;
  const evaluation = evaluateStaffTodoCapture(row, params.capture ?? {});
  if (!evaluation.ok) {
    return {
      ok: false,
      error: evaluation.error ?? "capture_invalid",
      status: 400,
    };
  }

  const timeZone = await loadRestaurantTimezone(admin, params.restaurantId);
  const periodStart = staffTodoPeriodStartIsoForStorage(
    row.recurrence,
    new Date(),
    timeZone,
  );
  const { data: existingRow } = await admin
    .from("restaurant_staff_todo_completions")
    .select("todo_id, staff_id, period_start, completed_at, reopened_at")
    .eq("todo_id", params.todoId)
    .eq("staff_id", params.completedByStaffId)
    .eq("period_start", periodStart)
    .maybeSingle();

  const wasAlreadyDone =
    existingRow &&
    !existingRow.reopened_at &&
    existingRow.completed_at &&
    isStaffTodoDoneForStaff(
      row,
      [existingRow as RestaurantStaffTodoCompletionRow],
      params.completedByStaffId,
      new Date(),
      timeZone,
    );

  if (wasAlreadyDone) {
    return { ok: true, todo_done_for_staff: true };
  }

  const now = new Date().toISOString();
  const { data: savedRow, error: upsertErr } = await admin
    .from("restaurant_staff_todo_completions")
    .upsert(
      {
        todo_id: params.todoId,
        staff_id: params.completedByStaffId,
        period_start: periodStart,
        completed_at: now,
        reopened_at: null,
        confirmed_at: now,
        completion_note: params.completionNote?.trim() || null,
        captured_numeric: evaluation.captured_numeric,
        captured_text: evaluation.captured_text,
        within_limits: evaluation.within_limits,
        corrective_action: evaluation.corrective_action,
      },
      { onConflict: "todo_id,staff_id,period_start" },
    )
    .select("todo_id, staff_id, period_start, completed_at, reopened_at")
    .single();

  if (upsertErr || !savedRow?.completed_at) {
    console.error("[display] todo completion upsert failed", upsertErr);
    return {
      ok: false,
      error: upsertErr?.code ?? "completion_save_failed",
      status: 500,
    };
  }

  const activeRow = savedRow;

  await clearDeferralsForTodo(admin, {
    staffId: params.completedByStaffId,
    todoId: params.todoId,
  });

  if (activeRow.reopened_at) {
    console.warn("[display] todo completion saved but still reopened", {
      todoId: params.todoId,
      staffId: params.completedByStaffId,
      completed_at: activeRow.completed_at,
    });
  }

  const { error: logErr } = await admin.from("restaurant_staff_todo_log_entries").insert({
    restaurant_id: params.restaurantId,
    todo_id: params.todoId,
    action: "completed" satisfies StaffTodoLogAction,
    actor_staff_id: params.completedByStaffId,
    details: {
      capture_type: row.capture_type,
      captured_numeric: evaluation.captured_numeric,
      captured_text: evaluation.captured_text,
      within_limits: evaluation.within_limits,
      has_deviation: evaluation.has_deviation,
      corrective_action: evaluation.corrective_action,
      period_start: periodStart,
    },
  });

  if (logErr) {
    console.error("[display] todo completion log failed", logErr);
  }

  const todoDoneForStaff = isStaffTodoDoneForStaff(
    row,
    [activeRow as RestaurantStaffTodoCompletionRow],
    params.completedByStaffId,
    new Date(),
    timeZone,
  );

  return { ok: true, todo_done_for_staff: todoDoneForStaff };
}

export async function reopenDisplayTodo(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    staffId: string;
    todoId: string;
  },
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const assigned = await assertDisplayTodoAssignedToStaff(
    admin,
    {
      restaurantId: params.restaurantId,
      staffId: params.staffId,
      todoId: params.todoId,
    },
    "id, restaurant_id, title, allow_reopen_on_display, recurrence, assignee_type, staff_id, position_tag_id, staff_assignees:restaurant_staff_todo_staff_assignees ( staff_id ), position_assignees:restaurant_staff_todo_position_assignees ( position_tag_id )",
  );
  if (!assigned.ok) {
    return assigned;
  }

  const row = assigned.row as {
    title: string;
    allow_reopen_on_display: boolean;
    recurrence: StaffTodoRecurrence | null;
  };

  if (!row.allow_reopen_on_display) {
    return { ok: false, error: "reopen_not_allowed", status: 403 };
  }

  const timeZone = await loadRestaurantTimezone(admin, params.restaurantId);
  const periodStart = staffTodoPeriodStartIsoForStorage(
    row.recurrence,
    new Date(),
    timeZone,
  );
  const now = new Date().toISOString();
  const { data: completion, error: loadErr } = await admin
    .from("restaurant_staff_todo_completions")
    .select("id, reopened_at")
    .eq("todo_id", params.todoId)
    .eq("staff_id", params.staffId)
    .eq("period_start", periodStart)
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
  const assigned = await assertDisplayTodoAssignedToStaff(
    admin,
    {
      restaurantId: params.restaurantId,
      staffId: params.staffId,
      todoId: params.todoId,
    },
    "id, restaurant_id, title, require_defer_reason, assignee_type, staff_id, position_tag_id, staff_assignees:restaurant_staff_todo_staff_assignees ( staff_id ), position_assignees:restaurant_staff_todo_position_assignees ( position_tag_id )",
  );
  if (!assigned.ok) {
    return assigned;
  }

  const row = assigned.row as {
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

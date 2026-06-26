import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { staffDisplayName } from "@/lib/types/staff";
import {
  assignedStaffIds,
  assignedPositionTagIds,
  formatAssigneeLabels,
  inferLegacyAssigneeType,
  isAssignedToStaffMember,
} from "@/lib/staff/assignee-matching";
import type {
  RestaurantStaffTodoLogEntry,
  RestaurantStaffTodoRow,
  StaffTodoLogAction,
  StaffTodoUpsertInput,
} from "@/lib/types/staff-todos";

const TODO_SELECT = `
  *,
  staff:restaurant_staff!restaurant_staff_todos_staff_id_fkey (
    id,
    given_name,
    family_name
  ),
  position_tag:restaurant_staff_position_tags (
    id,
    name
  ),
  staff_assignees:restaurant_staff_todo_staff_assignees (
    staff_id,
    staff:restaurant_staff (
      id,
      given_name,
      family_name
    )
  ),
  position_assignees:restaurant_staff_todo_position_assignees (
    position_tag_id,
    position_tag:restaurant_staff_position_tags (
      id,
      name
    )
  ),
  completions:restaurant_staff_todo_completions (
    id,
    todo_id,
    staff_id,
    completed_at,
    reopened_at,
    confirmed_at,
    completion_note,
    created_at
  )
`;

const LOG_SELECT = `
  *,
  todo:restaurant_staff_todos ( id, title ),
  actor_profile:profiles!restaurant_staff_todo_log_entries_actor_user_id_fkey (
    id,
    display_name
  )
`;

function mapTodoError(error: { message: string } | null): string | null {
  if (!error) return null;
  return error.message;
}

async function syncStaffTodoAssignees(
  todoId: string,
  staffIds: string[],
  positionTagIds: string[],
): Promise<{ error: string | null }> {
  const supabase = createSupabaseBrowserClient();

  const { error: delStaffErr } = await supabase
    .from("restaurant_staff_todo_staff_assignees")
    .delete()
    .eq("todo_id", todoId);
  if (delStaffErr) return { error: delStaffErr.message };

  const { error: delTagErr } = await supabase
    .from("restaurant_staff_todo_position_assignees")
    .delete()
    .eq("todo_id", todoId);
  if (delTagErr) return { error: delTagErr.message };

  if (staffIds.length > 0) {
    const { error } = await supabase.from("restaurant_staff_todo_staff_assignees").insert(
      staffIds.map((staff_id) => ({ todo_id: todoId, staff_id })),
    );
    if (error) return { error: error.message };
  }

  if (positionTagIds.length > 0) {
    const { error } = await supabase
      .from("restaurant_staff_todo_position_assignees")
      .insert(
        positionTagIds.map((position_tag_id) => ({ todo_id: todoId, position_tag_id })),
      );
    if (error) return { error: error.message };
  }

  return { error: null };
}

export async function fetchStaffTodosForRestaurant(
  restaurantId: string,
  options?: { includeArchived?: boolean; staffId?: string | null },
): Promise<{ data: RestaurantStaffTodoRow[]; error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  let query = supabase
    .from("restaurant_staff_todos")
    .select(TODO_SELECT)
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (!options?.includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;
  let rows = (data ?? []) as RestaurantStaffTodoRow[];

  if (options?.staffId) {
    const { data: staffRow } = await supabase
      .from("restaurant_staff")
      .select("position_tag_id")
      .eq("id", options.staffId)
      .maybeSingle();
    const positionTagId =
      (staffRow as { position_tag_id: string | null } | null)?.position_tag_id ?? null;
    rows = rows.filter((t) =>
      isAssignedToStaffMember(t, options.staffId!, positionTagId, {
        emptyMeansAll: false,
      }),
    );
  }

  return { data: rows, error: mapTodoError(error) };
}

export async function upsertStaffTodo(
  restaurantId: string,
  input: StaffTodoUpsertInput,
  todoId?: string | null,
): Promise<{ data: RestaurantStaffTodoRow | null; error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const staffIds = [...new Set(input.staff_ids)];
  const positionTagIds = [...new Set(input.position_tag_ids)];
  const assigneeType = inferLegacyAssigneeType(staffIds, positionTagIds);

  const payload = {
    restaurant_id: restaurantId,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    assignee_type: assigneeType,
    staff_id: staffIds.length === 1 && positionTagIds.length === 0 ? staffIds[0]! : null,
    position_tag_id:
      positionTagIds.length === 1 && staffIds.length === 0 ? positionTagIds[0]! : null,
    priority: input.priority,
    display_from: input.display_from || null,
    display_until: input.display_until || null,
    show_on_display: input.show_on_display ?? true,
    show_before_clock_in: input.show_before_clock_in ?? false,
    show_before_break_start: input.show_before_break_start ?? false,
    show_before_break_end: input.show_before_break_end ?? false,
    show_before_clock_out: input.show_before_clock_out ?? false,
    show_on_pin_login: input.show_on_pin_login ?? false,
    completion_mode: input.completion_mode ?? "any_one",
    require_defer_reason: input.require_defer_reason ?? false,
    blocks_shift_end: input.blocks_shift_end ?? false,
    allow_reopen_on_display: input.allow_reopen_on_display ?? false,
    sort_order: input.sort_order ?? 0,
  };

  let savedId = todoId ?? null;
  let row: RestaurantStaffTodoRow | null = null;
  let saveError: { message: string } | null = null;

  if (todoId) {
    const { data, error } = await supabase
      .from("restaurant_staff_todos")
      .update(payload)
      .eq("id", todoId)
      .eq("restaurant_id", restaurantId)
      .select("id")
      .single();
    saveError = error;
    savedId = (data as { id: string } | null)?.id ?? todoId;
  } else {
    const { data: userData } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("restaurant_staff_todos")
      .insert({ ...payload, created_by: userData.user?.id ?? null })
      .select("id")
      .single();
    saveError = error;
    savedId = (data as { id: string } | null)?.id ?? null;
  }

  if (saveError || !savedId) {
    return { data: null, error: mapTodoError(saveError) };
  }

  const sync = await syncStaffTodoAssignees(savedId, staffIds, positionTagIds);
  if (sync.error) {
    return { data: null, error: sync.error };
  }

  const { data: refreshed, error: reloadErr } = await supabase
    .from("restaurant_staff_todos")
    .select(TODO_SELECT)
    .eq("id", savedId)
    .single();

  row = (refreshed as RestaurantStaffTodoRow | null) ?? null;
  return { data: row, error: mapTodoError(reloadErr) };
}

export async function archiveStaffTodo(
  restaurantId: string,
  todoId: string,
): Promise<{ error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("restaurant_staff_todos")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", todoId)
    .eq("restaurant_id", restaurantId);
  return { error: mapTodoError(error) };
}

export async function completeStaffTodoForStaff(
  todoId: string,
  staffId: string,
): Promise<{ error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("restaurant_staff_todo_completions").upsert(
    {
      todo_id: todoId,
      staff_id: staffId,
      completed_at: new Date().toISOString(),
      reopened_at: null,
      confirmed_at: new Date().toISOString(),
    },
    { onConflict: "todo_id,staff_id" },
  );
  return { error: mapTodoError(error) };
}

export async function insertStaffTodoLogEntry(input: {
  restaurantId: string;
  todoId?: string | null;
  action: StaffTodoLogAction;
  details?: Record<string, unknown>;
  actorStaffId?: string | null;
}): Promise<{ error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("restaurant_staff_todo_log_entries").insert({
    restaurant_id: input.restaurantId,
    todo_id: input.todoId ?? null,
    action: input.action,
    actor_user_id: userData.user?.id ?? null,
    actor_staff_id: input.actorStaffId ?? null,
    details: input.details ?? {},
  });
  return { error: mapTodoError(error) };
}

export async function fetchStaffTodoLogEntries(
  restaurantId: string,
): Promise<{ data: RestaurantStaffTodoLogEntry[]; error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("restaurant_staff_todo_log_entries")
    .select(LOG_SELECT)
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(500);
  return {
    data: (data ?? []) as RestaurantStaffTodoLogEntry[],
    error: mapTodoError(error),
  };
}

export function staffTodoAssigneeLabel(todo: RestaurantStaffTodoRow): string {
  return formatAssigneeLabels(todo, (s) =>
    staffDisplayName({
      given_name: s.given_name,
      family_name: s.family_name ?? "",
    }),
  );
}

export { assignedStaffIds, assignedPositionTagIds };

export function resolveStaffTodoLogActorLabel(entry: RestaurantStaffTodoLogEntry): string {
  return entry.actor_profile?.display_name?.trim() || "Unbekannt";
}

export function formatStaffTodoLogDetails(entry: RestaurantStaffTodoLogEntry): string {
  const d = entry.details;
  if (!d || typeof d !== "object") return "—";
  const title = typeof d.title === "string" ? d.title : null;
  const reason = typeof d.reason === "string" ? d.reason : null;
  if (reason) return reason;
  if (title) return title;
  return "—";
}

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { staffDisplayName } from "@/lib/types/staff";
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
  completions:restaurant_staff_todo_completions (
    id,
    todo_id,
    staff_id,
    completed_at,
    reopened_at,
    confirmed_at,
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

  if (options?.staffId) {
    query = query.or(
      `staff_id.eq.${options.staffId},assignee_type.eq.position_tag`,
    );
  }

  const { data, error } = await query;
  return { data: (data ?? []) as RestaurantStaffTodoRow[], error: mapTodoError(error) };
}

export async function upsertStaffTodo(
  restaurantId: string,
  input: StaffTodoUpsertInput,
  todoId?: string | null,
): Promise<{ data: RestaurantStaffTodoRow | null; error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const payload = {
    restaurant_id: restaurantId,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    assignee_type: input.assignee_type,
    staff_id: input.assignee_type === "staff" ? input.staff_id ?? null : null,
    position_tag_id:
      input.assignee_type === "position_tag" ? input.position_tag_id ?? null : null,
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

  if (todoId) {
    const { data, error } = await supabase
      .from("restaurant_staff_todos")
      .update(payload)
      .eq("id", todoId)
      .eq("restaurant_id", restaurantId)
      .select(TODO_SELECT)
      .single();
    return { data: data as RestaurantStaffTodoRow | null, error: mapTodoError(error) };
  }

  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("restaurant_staff_todos")
    .insert({ ...payload, created_by: userData.user?.id ?? null })
    .select(TODO_SELECT)
    .single();
  return { data: data as RestaurantStaffTodoRow | null, error: mapTodoError(error) };
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
  if (todo.assignee_type === "staff" && todo.staff) {
    return staffDisplayName({
      given_name: todo.staff.given_name,
      family_name: todo.staff.family_name ?? "",
    });
  }
  if (todo.assignee_type === "position_tag" && todo.position_tag) {
    return todo.position_tag.name;
  }
  return todo.assignee_type === "staff" ? "Mitarbeiter" : "Position";
}

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

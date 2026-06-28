import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  clampListPage,
  clampListPageSize,
  listPageRange,
  LIST_PAGE_SIZE_DEFAULT,
  parseListPageParam,
  totalPagesFromCount,
  type PaginatedListResult,
} from "@/lib/constants/list-pagination";
import { isMissingSchemaError } from "@/lib/supabase/schema-error";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  loadStaffTodoCompletionsByTodoId,
} from "@/lib/staff/staff-todos-status-load";
import { staffTodoPeriodStartIsoForStorage } from "@/lib/staff/staff-todo-due";
import type { StaffTodoRecurrence } from "@/lib/types/staff-todos";
import { DEFAULT_RESTAURANT_TIMEZONE } from "@/lib/restaurant/restaurant-timezone";
import { fetchRestaurantIanaTimezone } from "@/lib/supabase/restaurant-timezone-db";
import { staffDisplayName } from "@/lib/types/staff";
import {
  assignedStaffIds,
  assignedPositionTagIds,
  formatAssigneeLabels,
  inferLegacyAssigneeType,
  isAssignedToStaffMember,
} from "@/lib/staff/assignee-matching";
import type {
  RestaurantStaffTodoCompletionRow,
  RestaurantStaffTodoLogEntry,
  RestaurantStaffTodoRow,
  RestaurantStaffTodoSettingsRow,
  StaffTodoLogAction,
  StaffTodoUpsertInput,
} from "@/lib/types/staff-todos";

const TODO_SELECT_LEGACY = `
  *,
  staff:restaurant_staff!restaurant_staff_todos_staff_id_fkey (
    id,
    given_name,
    family_name
  ),
  position_tag:restaurant_staff_position_tags!restaurant_staff_todos_position_tag_id_fkey (
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
    position_tag:restaurant_staff_position_tags!restaurant_staff_todo_position_assignees_position_tag_id_fkey (
      id,
      name
    )
  ),
  position_assignees:restaurant_staff_todo_position_assignees (
    position_tag_id,
    position_tag:restaurant_staff_position_tags!restaurant_staff_todo_position_assignees_position_tag_id_fkey (
      id,
      name
    )
  )
`;

const TODO_SELECT = `
  *,
  staff:restaurant_staff!restaurant_staff_todos_staff_id_fkey (
    id,
    given_name,
    family_name
  ),
  position_tag:restaurant_staff_position_tags!restaurant_staff_todos_position_tag_id_fkey (
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
    position_tag:restaurant_staff_position_tags!restaurant_staff_todo_position_assignees_position_tag_id_fkey (
      id,
      name
    )
  ),
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

const TODO_COMPLETION_SELECT = `
  id,
  todo_id,
  staff_id,
  period_start,
  completed_at,
  reopened_at,
  confirmed_at,
  completion_note,
  captured_numeric,
  captured_text,
  within_limits,
  corrective_action,
  created_at,
  staff:restaurant_staff (
    id,
    given_name,
    family_name
  )
`;

const TODO_COMPLETION_SELECT_LEGACY = `
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

const LOG_SELECT = `
  *,
  todo:restaurant_staff_todos ( id, title ),
  actor_profile:profiles!restaurant_staff_todo_log_entries_actor_user_id_fkey (
    id,
    display_name
  ),
  actor_staff:restaurant_staff!restaurant_staff_todo_log_entries_actor_staff_id_fkey (
    id,
    given_name,
    family_name
  )
`;

type StaffTodoLogActorStaff = {
  id: string;
  given_name: string;
  family_name: string | null;
};

function normalizeStaffTodoLogActorStaff(
  raw: unknown,
): StaffTodoLogActorStaff | null {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    return (raw[0] as StaffTodoLogActorStaff | undefined) ?? null;
  }
  return raw as StaffTodoLogActorStaff;
}

function normalizeStaffTodoLogEntry<T extends RestaurantStaffTodoLogEntry>(
  row: T & { actor_staff?: unknown },
): T {
  return {
    ...row,
    actor_staff: normalizeStaffTodoLogActorStaff(row.actor_staff),
  };
}

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

async function fetchRestaurantTimezone(
  _supabase: ReturnType<typeof createSupabaseBrowserClient>,
  restaurantId: string,
): Promise<string> {
  return fetchRestaurantIanaTimezone(restaurantId);
}

async function attachRecentStaffTodoCompletions(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  restaurantId: string,
  rows: RestaurantStaffTodoRow[],
  useLegacyFields: boolean,
  restaurantTimezone: string,
): Promise<RestaurantStaffTodoRow[]> {
  if (rows.length === 0) return rows;

  const todos = rows.map((r) => ({ id: r.id, recurrence: r.recurrence }));
  const byTodo = await loadStaffTodoCompletionsByTodoId(
    supabase,
    restaurantId,
    todos,
    { useLegacyFields, timeZone: restaurantTimezone },
  );

  return rows.map((row) => ({
    ...row,
    completions: byTodo.get(row.id) ?? [],
  }));
}

export type FetchStaffTodosResult = {
  data: RestaurantStaffTodoRow[];
  error: string | null;
  restaurantTimezone: string;
};

export async function fetchStaffTodosForRestaurant(
  restaurantId: string,
  options?: { includeArchived?: boolean; staffId?: string | null },
): Promise<FetchStaffTodosResult> {
  const supabase = createSupabaseBrowserClient();
  const [restaurantTimezone, todosResult] = await Promise.all([
    fetchRestaurantTimezone(supabase, restaurantId),
    (async () => {
      let query = supabase
        .from("restaurant_staff_todos")
        .select(TODO_SELECT)
        .eq("restaurant_id", restaurantId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (!options?.includeArchived) {
        query = query.is("archived_at", null);
      }

      let { data, error } = await query;
      let useLegacyFields = false;
      if (error && isMissingSchemaError(error.message)) {
        let legacyQuery = supabase
          .from("restaurant_staff_todos")
          .select(TODO_SELECT_LEGACY)
          .eq("restaurant_id", restaurantId)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: false });
        if (!options?.includeArchived) {
          legacyQuery = legacyQuery.is("archived_at", null);
        }
        const legacy = await legacyQuery;
        data = legacy.data;
        error = legacy.error;
        useLegacyFields = true;
      }
      return { data, error, useLegacyFields };
    })(),
  ]);

  let rows = (todosResult.data ?? []) as RestaurantStaffTodoRow[];

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

  rows = await attachRecentStaffTodoCompletions(
    supabase,
    restaurantId,
    rows,
    todosResult.useLegacyFields,
    restaurantTimezone,
  );

  return {
    data: rows,
    error: mapTodoError(todosResult.error),
    restaurantTimezone,
  };
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
    recurrence: input.recurrence ?? null,
    capture_type: input.capture_type ?? "boolean",
    target_min: input.target_min ?? null,
    target_max: input.target_max ?? null,
    checklist_device_id: input.checklist_device_id ?? null,
    checklist_area_id: input.checklist_area_id ?? null,
    require_corrective_on_deviation:
      input.require_corrective_on_deviation ??
      (input.target_min != null ||
      input.target_max != null ||
      input.capture_type === "temperature" ||
      input.capture_type === "number"
        ? true
        : false),
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
  options: {
    recurrence: StaffTodoRecurrence | null;
    timeZone?: string;
  },
): Promise<{ error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const timeZone = options.timeZone ?? DEFAULT_RESTAURANT_TIMEZONE;
  const periodStart = staffTodoPeriodStartIsoForStorage(
    options.recurrence,
    new Date(),
    timeZone,
  );
  const now = new Date().toISOString();
  const { error } = await supabase.from("restaurant_staff_todo_completions").upsert(
    {
      todo_id: todoId,
      staff_id: staffId,
      period_start: periodStart,
      completed_at: now,
      reopened_at: null,
      confirmed_at: now,
    },
    { onConflict: "todo_id,staff_id,period_start" },
  );
  return { error: mapTodoError(error) };
}

export async function reopenStaffTodo(
  restaurantId: string,
  todoId: string,
  options: {
    recurrence: StaffTodoRecurrence | null;
    timeZone?: string;
    todoTitle?: string;
  },
): Promise<{ error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const timeZone = options.timeZone ?? DEFAULT_RESTAURANT_TIMEZONE;
  const periodStart = staffTodoPeriodStartIsoForStorage(
    options.recurrence,
    new Date(),
    timeZone,
  );
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("restaurant_staff_todo_completions")
    .update({ reopened_at: now })
    .eq("todo_id", todoId)
    .eq("period_start", periodStart)
    .is("reopened_at", null);

  if (error) {
    return { error: mapTodoError(error) };
  }

  return insertStaffTodoLogEntry({
    restaurantId,
    todoId,
    action: "reopened",
    details: { title: options.todoTitle },
  });
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
    data: (data ?? []).map((row) =>
      normalizeStaffTodoLogEntry(row as RestaurantStaffTodoLogEntry),
    ),
    error: mapTodoError(error),
  };
}

const PROTOCOL_LOG_SELECT = `
  *,
  todo:restaurant_staff_todos (
    id,
    title,
    capture_type,
    checklist_area_id,
    checklist_device_id,
    checklist_device:restaurant_checklist_devices ( id, name ),
    checklist_area:restaurant_checklist_areas ( id, name, background_color )
  ),
  actor_profile:profiles!restaurant_staff_todo_log_entries_actor_user_id_fkey (
    id,
    display_name
  ),
  actor_staff:restaurant_staff!restaurant_staff_todo_log_entries_actor_staff_id_fkey (
    id,
    given_name,
    family_name
  )
`;

export type StaffTodoLogEntryForProtocol = RestaurantStaffTodoLogEntry & {
  todo?: {
    id: string;
    title: string;
    capture_type?: RestaurantStaffTodoRow["capture_type"];
    checklist_area_id: string | null;
    checklist_device_id: string | null;
    checklist_device?: { id: string; name: string } | null;
    checklist_area?: { id: string; name: string; background_color: string } | null;
  } | null;
  actor_staff?: {
    id: string;
    given_name: string;
    family_name: string | null;
  } | null;
};

export async function fetchStaffTodoLogEntriesForProtocol(
  restaurantId: string,
): Promise<{ data: StaffTodoLogEntryForProtocol[]; error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("restaurant_staff_todo_log_entries")
    .select(PROTOCOL_LOG_SELECT)
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error && isMissingSchemaError(error.message)) {
    const basic = await fetchStaffTodoLogEntries(restaurantId);
    return {
      data: (basic.data ?? []) as StaffTodoLogEntryForProtocol[],
      error: basic.error,
    };
  }

  return {
    data: (data ?? []).map((row) =>
      normalizeStaffTodoLogEntry(row as StaffTodoLogEntryForProtocol),
    ),
    error: mapTodoError(error),
  };
}

const PROTOCOL_COMPLETION_SELECT = `
  id,
  todo_id,
  staff_id,
  completed_at,
  completion_note,
  captured_numeric,
  captured_text,
  within_limits,
  corrective_action,
  staff:restaurant_staff (
    id,
    given_name,
    family_name
  ),
  todo:restaurant_staff_todos!inner (
    id,
    title,
    restaurant_id,
    capture_type,
    checklist_area_id,
    checklist_device_id,
    checklist_device:restaurant_checklist_devices ( id, name ),
    checklist_area:restaurant_checklist_areas ( id, name, background_color )
  )
`;

export type StaffTodoCompletionForProtocol = {
  id: string;
  todo_id: string;
  staff_id: string;
  completed_at: string;
  completion_note: string | null;
  captured_numeric: number | null;
  captured_text: string | null;
  within_limits: boolean | null;
  corrective_action: string | null;
  staff?: {
    id: string;
    given_name: string;
    family_name: string | null;
  } | null;
  todo: {
    id: string;
    title: string;
    restaurant_id: string;
    capture_type: RestaurantStaffTodoRow["capture_type"];
    checklist_area_id: string | null;
    checklist_device_id: string | null;
    checklist_device?: { id: string; name: string } | null;
    checklist_area?: { id: string; name: string; background_color: string } | null;
  };
};

export async function fetchStaffTodoCompletionsForProtocol(
  restaurantId: string,
): Promise<{ data: StaffTodoCompletionForProtocol[]; error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("restaurant_staff_todo_completions")
    .select(PROTOCOL_COMPLETION_SELECT)
    .eq("todo.restaurant_id", restaurantId)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(500);

  if (error && isMissingSchemaError(error.message)) {
    const todoRes = await fetchStaffTodosForRestaurant(restaurantId);
    if (todoRes.error) return { data: [], error: todoRes.error };
    const todos = todoRes.data;
    const fallback: StaffTodoCompletionForProtocol[] = [];
    for (const todo of todos) {
      for (const c of todo.completions ?? []) {
        if (!c.completed_at) continue;
        fallback.push({
          id: c.id,
          todo_id: c.todo_id,
          staff_id: c.staff_id,
          completed_at: c.completed_at,
          completion_note: c.completion_note,
          captured_numeric: c.captured_numeric ?? null,
          captured_text: c.captured_text ?? null,
          within_limits: c.within_limits ?? null,
          corrective_action: c.corrective_action ?? null,
          staff: null,
          todo: {
            id: todo.id,
            title: todo.title,
            restaurant_id: todo.restaurant_id,
            capture_type: todo.capture_type ?? "checkbox",
            checklist_area_id: todo.checklist_area_id ?? null,
            checklist_device_id: todo.checklist_device_id ?? null,
            checklist_device: todo.checklist_device ?? null,
            checklist_area: todo.checklist_area ?? null,
          },
        });
      }
    }
    fallback.sort(
      (a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime(),
    );
    return { data: fallback.slice(0, 500), error: null };
  }

  return {
    data: (data ?? []) as unknown as StaffTodoCompletionForProtocol[],
    error: mapTodoError(error),
  };
}

function escapeProtocolIlikePattern(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

export type StaffTodoProtocolPageFilters = {
  page?: number;
  pageSize?: number;
  sinceIso?: string | null;
  areaId?: string;
  deviceId?: string;
  deviation?: "all" | "deviation" | "ok";
  sortKey?: "newest" | "oldest";
  search?: string;
};

export async function listStaffTodoCompletionsProtocolPage(
  supabase: SupabaseClient,
  restaurantId: string,
  filters: StaffTodoProtocolPageFilters = {},
): Promise<PaginatedListResult<StaffTodoCompletionForProtocol>> {
  const pageSize = clampListPageSize(filters.pageSize ?? LIST_PAGE_SIZE_DEFAULT);
  const requestedPage = parseListPageParam(
    filters.page != null ? String(filters.page) : "1",
  );
  const ascending = filters.sortKey === "oldest";
  const search = filters.search?.trim() ?? "";

  const buildQuery = (page: number) => {
    const { from, to } = listPageRange(page, pageSize);
    let q = supabase
      .from("restaurant_staff_todo_completions")
      .select(PROTOCOL_COMPLETION_SELECT, { count: "exact" })
      .eq("todo.restaurant_id", restaurantId)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending })
      .range(from, to);

    if (filters.sinceIso) {
      q = q.gte("completed_at", filters.sinceIso);
    }
    if (filters.areaId && filters.areaId !== "all") {
      q = q.eq("todo.checklist_area_id", filters.areaId);
    }
    if (filters.deviceId && filters.deviceId !== "all") {
      q = q.eq("todo.checklist_device_id", filters.deviceId);
    }
    if (filters.deviation === "deviation") {
      q = q.eq("within_limits", false);
    } else if (filters.deviation === "ok") {
      q = q.or("within_limits.is.null,within_limits.eq.true");
    }
    if (search) {
      const pattern = `%${escapeProtocolIlikePattern(search)}%`;
      q = q.or(
        `todo.title.ilike.${pattern},captured_text.ilike.${pattern},completion_note.ilike.${pattern}`,
      );
    }
    return q;
  };

  let page = requestedPage;
  let { data, error, count } = await buildQuery(page);
  const totalCount = count ?? 0;
  const totalPages = totalPagesFromCount(totalCount, pageSize);
  page = clampListPage(page, totalPages);

  if (page !== requestedPage) {
    ({ data, error, count } = await buildQuery(page));
  }

  if (error) {
    throw new Error(mapTodoError(error) ?? error.message);
  }

  return {
    items: (data ?? []) as unknown as StaffTodoCompletionForProtocol[],
    page,
    pageSize,
    totalCount: count ?? totalCount,
    totalPages,
  };
}

/** Erfassungs-Protokoll — append-only Log (completed / completed_by_manager). */
export async function listStaffTodoCaptureLogsProtocolPage(
  supabase: SupabaseClient,
  restaurantId: string,
  filters: StaffTodoProtocolPageFilters = {},
): Promise<PaginatedListResult<StaffTodoLogEntryForProtocol>> {
  const pageSize = clampListPageSize(filters.pageSize ?? LIST_PAGE_SIZE_DEFAULT);
  const requestedPage = parseListPageParam(
    filters.page != null ? String(filters.page) : "1",
  );
  const ascending = filters.sortKey === "oldest";
  const search = filters.search?.trim() ?? "";

  const buildQuery = (page: number) => {
    const { from, to } = listPageRange(page, pageSize);
    let q = supabase
      .from("restaurant_staff_todo_log_entries")
      .select(PROTOCOL_LOG_SELECT, { count: "exact" })
      .eq("restaurant_id", restaurantId)
      .in("action", ["completed", "completed_by_manager"])
      .order("created_at", { ascending })
      .range(from, to);

    if (filters.sinceIso) {
      q = q.gte("created_at", filters.sinceIso);
    }
    if (filters.areaId && filters.areaId !== "all") {
      q = q.eq("todo.checklist_area_id", filters.areaId);
    }
    if (filters.deviceId && filters.deviceId !== "all") {
      q = q.eq("todo.checklist_device_id", filters.deviceId);
    }
    if (filters.deviation === "deviation") {
      q = q.or(
        "details->>has_deviation.eq.true,details->>within_limits.eq.false",
      );
    } else if (filters.deviation === "ok") {
      q = q.or(
        "details->>within_limits.is.null,details->>within_limits.eq.true",
      );
    }
    if (search) {
      const pattern = `%${escapeProtocolIlikePattern(search)}%`;
      q = q.or(
        `todo.title.ilike.${pattern},details->>captured_text.ilike.${pattern},details->>corrective_action.ilike.${pattern}`,
      );
    }
    return q;
  };

  let page = requestedPage;
  let { data, error, count } = await buildQuery(page);
  const totalCount = count ?? 0;
  const totalPages = totalPagesFromCount(totalCount, pageSize);
  page = clampListPage(page, totalPages);

  if (page !== requestedPage) {
    ({ data, error, count } = await buildQuery(page));
  }

  if (error) {
    throw new Error(mapTodoError(error) ?? error.message);
  }

  return {
    items: (data ?? []).map((row) =>
      normalizeStaffTodoLogEntry(row as StaffTodoLogEntryForProtocol),
    ),
    page,
    pageSize,
    totalCount: count ?? totalCount,
    totalPages,
  };
}

export async function listStaffTodoLogsProtocolPage(
  supabase: SupabaseClient,
  restaurantId: string,
  filters: StaffTodoProtocolPageFilters = {},
): Promise<PaginatedListResult<StaffTodoLogEntryForProtocol>> {
  const pageSize = clampListPageSize(filters.pageSize ?? LIST_PAGE_SIZE_DEFAULT);
  const requestedPage = parseListPageParam(
    filters.page != null ? String(filters.page) : "1",
  );
  const ascending = filters.sortKey === "oldest";
  const search = filters.search?.trim() ?? "";

  const buildQuery = (page: number) => {
    const { from, to } = listPageRange(page, pageSize);
    let q = supabase
      .from("restaurant_staff_todo_log_entries")
      .select(PROTOCOL_LOG_SELECT, { count: "exact" })
      .eq("restaurant_id", restaurantId)
      .not("action", "in", '("completed","completed_by_manager")')
      .order("created_at", { ascending })
      .range(from, to);

    if (filters.sinceIso) {
      q = q.gte("created_at", filters.sinceIso);
    }
    if (filters.areaId && filters.areaId !== "all") {
      q = q.eq("todo.checklist_area_id", filters.areaId);
    }
    if (filters.deviceId && filters.deviceId !== "all") {
      q = q.eq("todo.checklist_device_id", filters.deviceId);
    }
    if (search) {
      const pattern = `%${escapeProtocolIlikePattern(search)}%`;
      q = q.or(`todo.title.ilike.${pattern},details->>reason.ilike.${pattern}`);
    }
    return q;
  };

  let page = requestedPage;
  let { data, error, count } = await buildQuery(page);
  const totalCount = count ?? 0;
  const totalPages = totalPagesFromCount(totalCount, pageSize);
  page = clampListPage(page, totalPages);

  if (page !== requestedPage) {
    ({ data, error, count } = await buildQuery(page));
  }

  if (error) {
    throw new Error(mapTodoError(error) ?? error.message);
  }

  return {
    items: (data ?? []).map((row) =>
      normalizeStaffTodoLogEntry(row as StaffTodoLogEntryForProtocol),
    ),
    page,
    pageSize,
    totalCount: count ?? totalCount,
    totalPages,
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

export function resolveStaffTodoLogActorLabel(
  entry: Pick<
    RestaurantStaffTodoLogEntry,
    "actor_profile" | "actor_staff_id"
  > & {
    actor_staff?: {
      given_name: string;
      family_name: string | null;
    } | null;
  },
): string {
  const profileName = entry.actor_profile?.display_name?.trim();
  if (profileName) return profileName;
  if (entry.actor_staff) {
    return staffDisplayName({
      given_name: entry.actor_staff.given_name,
      family_name: entry.actor_staff.family_name ?? "",
    });
  }
  return "Unbekannt";
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

export async function fetchStaffTodoSettings(
  restaurantId: string,
): Promise<{ data: RestaurantStaffTodoSettingsRow | null; error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("restaurant_staff_todo_settings")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  return {
    data: (data as RestaurantStaffTodoSettingsRow | null) ?? null,
    error: mapTodoError(error),
  };
}

export async function upsertStaffTodoSettings(
  restaurantId: string,
  input: {
    deferReasonDefault: string | null;
    notifyOnCompleted: boolean;
    notifyOnDeferred: boolean;
  },
): Promise<{ error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("restaurant_staff_todo_settings").upsert(
    {
      restaurant_id: restaurantId,
      defer_reason_default: input.deferReasonDefault?.trim() || null,
      notify_on_completed: input.notifyOnCompleted,
      notify_on_deferred: input.notifyOnDeferred,
    },
    { onConflict: "restaurant_id" },
  );
  return { error: mapTodoError(error) };
}

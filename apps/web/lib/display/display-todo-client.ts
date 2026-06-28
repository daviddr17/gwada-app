import type {
  StaffTodoCaptureType,
  StaffTodoComputedStatus,
  StaffTodoPriority,
  StaffTodoRecurrence,
} from "@/lib/types/staff-todos";
import type { StaffTodoCapturePayload } from "@/lib/staff/staff-todo-capture";
import type { StaffTodoDisplayUrgency } from "@/lib/staff/staff-todo-status";

/** Schlanke ToDo-Darstellung für Display (Popups, Badge, Checklisten-Modul). */
export type DisplayTodoClient = {
  id: string;
  title: string;
  description: string | null;
  priority: StaffTodoPriority;
  require_defer_reason: boolean;
  blocks_shift_end: boolean;
  allow_reopen_on_display: boolean;
  recurrence: StaffTodoRecurrence | null;
  capture_type: StaffTodoCaptureType;
  target_min: number | null;
  target_max: number | null;
  require_corrective_on_deviation: boolean;
  checklist_area: {
    id: string;
    name: string;
    background_color: string;
  } | null;
  checklist_device: {
    id: string;
    name: string;
    area_id: string | null;
    target_min: number | null;
    target_max: number | null;
  } | null;
  status: StaffTodoComputedStatus;
  done_for_staff: boolean;
  captured_numeric: number | null;
  captured_text: string | null;
  completion_note: string | null;
  within_limits: boolean | null;
  corrective_action: string | null;
};

export type DisplayTodoActionResult =
  | {
      ok: true;
      todo_done_for_staff: boolean;
      badge_count: number;
      badge_urgency: StaffTodoDisplayUrgency;
    }
  | { ok: false; error: string };

export function isDisplayChecklistTodo(todo: Pick<DisplayTodoClient, "capture_type">): boolean {
  return todo.capture_type !== "none";
}

function parseDisplayTodoActionResponse(
  res: Response,
  data: {
    ok?: boolean;
    error?: string;
    todo_done_for_staff?: boolean;
    badge_count?: number;
    badge_urgency?: StaffTodoDisplayUrgency;
  },
): DisplayTodoActionResult {
  if (!res.ok || data.ok === false) {
    return { ok: false, error: data.error ?? "unknown" };
  }
  return {
    ok: true,
    todo_done_for_staff: data.todo_done_for_staff ?? true,
    badge_count: data.badge_count ?? 0,
    badge_urgency: data.badge_urgency ?? "green",
  };
}

export async function postDisplayTodoComplete(
  todoId: string,
  opts?: {
    completionNote?: string | null;
    capture?: StaffTodoCapturePayload;
  },
): Promise<DisplayTodoActionResult> {
  const capture = opts?.capture;
  const body: Record<string, unknown> = {
    action: "complete",
    todo_id: todoId,
    completion_note: opts?.completionNote ?? null,
  };
  if (capture?.captured_numeric != null && !Number.isNaN(capture.captured_numeric)) {
    body.captured_numeric = capture.captured_numeric;
  }
  if (capture?.captured_text?.trim()) {
    body.captured_text = capture.captured_text.trim();
  }
  if (capture?.captured_boolean === true) {
    body.captured_boolean = true;
  }
  if (capture?.corrective_action?.trim()) {
    body.corrective_action = capture.corrective_action.trim();
  }

  const res = await fetch("/api/display/todos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  let data: {
    ok?: boolean;
    error?: string;
    todo_done_for_staff?: boolean;
    badge_count?: number;
    badge_urgency?: StaffTodoDisplayUrgency;
  } = {};
  try {
    data = (await res.json()) as typeof data;
  } catch {
    return { ok: false, error: "invalid_response" };
  }
  return parseDisplayTodoActionResponse(res, data);
}

export async function postDisplayTodoDefer(
  todoId: string,
  opts: {
    trigger: string;
    reason?: string | null;
  },
): Promise<DisplayTodoActionResult> {
  const res = await fetch("/api/display/todos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      action: "defer",
      todo_id: todoId,
      trigger: opts.trigger,
      reason: opts.reason ?? null,
    }),
  });
  let data: {
    ok?: boolean;
    error?: string;
    badge_count?: number;
    badge_urgency?: StaffTodoDisplayUrgency;
  } = {};
  try {
    data = (await res.json()) as typeof data;
  } catch {
    return { ok: false, error: "invalid_response" };
  }
  return parseDisplayTodoActionResponse(res, data);
}

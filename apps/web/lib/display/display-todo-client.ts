import type {
  StaffTodoCaptureType,
  StaffTodoComputedStatus,
  StaffTodoPriority,
  StaffTodoRecurrence,
} from "@/lib/types/staff-todos";
import type { StaffTodoCapturePayload } from "@/lib/staff/staff-todo-capture";

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
};

export function isDisplayChecklistTodo(todo: Pick<DisplayTodoClient, "capture_type">): boolean {
  return todo.capture_type !== "none";
}

export async function postDisplayTodoComplete(
  todoId: string,
  opts?: {
    completionNote?: string | null;
    capture?: StaffTodoCapturePayload;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch("/api/display/todos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      action: "complete",
      todo_id: todoId,
      completion_note: opts?.completionNote ?? null,
      captured_numeric: opts?.capture?.captured_numeric ?? null,
      captured_text: opts?.capture?.captured_text ?? null,
      captured_boolean: opts?.capture?.captured_boolean ?? null,
      corrective_action: opts?.capture?.corrective_action ?? null,
    }),
  });
  const data = (await res.json()) as { error?: string };
  if (!res.ok) {
    return { ok: false, error: data.error ?? "unknown" };
  }
  return { ok: true };
}

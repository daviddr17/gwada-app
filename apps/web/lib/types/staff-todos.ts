export type StaffTodoAssigneeType = "staff" | "position_tag" | "mixed";

export type StaffTodoPriority = "high" | "medium" | "low";

export type StaffTodoCompletionMode = "any_one" | "each_assignee";

export type StaffTodoDeferTrigger =
  | "clock_in"
  | "break_start"
  | "break_end"
  | "clock_out"
  | "pin_login";

export type StaffTodoLogAction =
  | "created"
  | "updated"
  | "archived"
  | "completed"
  | "reopened"
  | "deferred"
  | "completed_by_manager";

export type StaffTodoComputedStatus =
  | "planned"
  | "open"
  | "overdue"
  | "partial"
  | "done"
  | "archived";

export const STAFF_TODO_RECURRENCES = [
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "ad_hoc",
] as const;

export type StaffTodoRecurrence = (typeof STAFF_TODO_RECURRENCES)[number];

export const STAFF_TODO_RECURRENCE_LABELS: Record<StaffTodoRecurrence, string> = {
  hourly: "Stündlich",
  daily: "Täglich",
  weekly: "Wöchentlich",
  monthly: "Monatlich",
  ad_hoc: "Bei Bedarf",
};

export const STAFF_TODO_CAPTURE_TYPES = [
  "none",
  "boolean",
  "temperature",
  "number",
  "text",
] as const;

export type StaffTodoCaptureType = (typeof STAFF_TODO_CAPTURE_TYPES)[number];

export const STAFF_TODO_CAPTURE_TYPE_LABELS: Record<StaffTodoCaptureType, string> = {
  none: "Keine Erfassung",
  boolean: "Erledigt",
  temperature: "Temperatur (°C)",
  number: "Zahl",
  text: "Text",
};

export type RestaurantStaffTodoRow = {
  id: string;
  restaurant_id: string;
  title: string;
  description: string | null;
  assignee_type: StaffTodoAssigneeType | null;
  staff_id: string | null;
  position_tag_id: string | null;
  priority: StaffTodoPriority;
  display_from: string | null;
  display_until: string | null;
  show_on_display: boolean;
  show_before_clock_in: boolean;
  show_before_break_start: boolean;
  show_before_break_end: boolean;
  show_before_clock_out: boolean;
  show_on_pin_login: boolean;
  allow_reopen_on_display: boolean;
  completion_mode: StaffTodoCompletionMode;
  require_defer_reason: boolean;
  blocks_shift_end: boolean;
  sort_order: number;
  recurrence: StaffTodoRecurrence | null;
  capture_type: StaffTodoCaptureType;
  target_min: number | null;
  target_max: number | null;
  checklist_device_id: string | null;
  checklist_area_id: string | null;
  require_corrective_on_deviation: boolean;
  created_by: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  staff?: { id: string; given_name: string; family_name: string | null } | null;
  position_tag?: { id: string; name: string } | null;
  staff_assignees?: {
    staff_id: string;
    staff?: { id: string; given_name: string; family_name: string | null } | null;
  }[];
  position_assignees?: {
    position_tag_id: string;
    position_tag?: { id: string; name: string } | null;
  }[];
  completions?: RestaurantStaffTodoCompletionRow[];
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

export type RestaurantStaffTodoCompletionRow = {
  id: string;
  todo_id: string;
  staff_id: string;
  completed_at: string;
  reopened_at: string | null;
  confirmed_at: string | null;
  completion_note: string | null;
  captured_numeric: number | null;
  captured_text: string | null;
  within_limits: boolean | null;
  corrective_action: string | null;
  created_at: string;
};

export type RestaurantStaffTodoLogEntry = {
  id: string;
  restaurant_id: string;
  todo_id: string | null;
  action: StaffTodoLogAction;
  actor_user_id: string | null;
  actor_staff_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
  todo?: { id: string; title: string } | null;
  actor_profile?: { id: string; display_name: string | null } | null;
};

export const STAFF_TODO_PRIORITY_LABELS: Record<StaffTodoPriority, string> = {
  high: "Hoch",
  medium: "Mittel",
  low: "Niedrig",
};

/** Chip-/Select-Streifen — rot / orange / grün wie Display-Dringlichkeit. */
export const STAFF_TODO_PRIORITY_COLORS: Record<StaffTodoPriority, string> = {
  high: "#ef4444",
  medium: "#f97316",
  low: "#22c55e",
};

export const STAFF_TODO_COMPLETION_MODE_LABELS: Record<
  StaffTodoCompletionMode,
  string
> = {
  any_one: "Einer reicht",
  each_assignee: "Jeder einzeln",
};

export const STAFF_TODO_LOG_ACTION_LABELS: Record<StaffTodoLogAction, string> = {
  created: "Angelegt",
  updated: "Bearbeitet",
  archived: "Archiviert",
  completed: "Erledigt",
  reopened: "Wiedereröffnet",
  deferred: "Verschoben",
  completed_by_manager: "Von Leitung erledigt",
};

export type StaffTodoUpsertInput = {
  title: string;
  description?: string | null;
  staff_ids: string[];
  position_tag_ids: string[];
  priority: StaffTodoPriority;
  display_from?: string | null;
  display_until?: string | null;
  show_on_display?: boolean;
  show_before_clock_in?: boolean;
  show_before_break_start?: boolean;
  show_before_break_end?: boolean;
  show_before_clock_out?: boolean;
  show_on_pin_login?: boolean;
  allow_reopen_on_display?: boolean;
  completion_mode?: StaffTodoCompletionMode;
  require_defer_reason?: boolean;
  blocks_shift_end?: boolean;
  sort_order?: number;
  recurrence?: StaffTodoRecurrence | null;
  capture_type?: StaffTodoCaptureType;
  target_min?: number | null;
  target_max?: number | null;
  checklist_device_id?: string | null;
  checklist_area_id?: string | null;
  require_corrective_on_deviation?: boolean;
};

export type RestaurantStaffTodoSettingsRow = {
  restaurant_id: string;
  defer_reason_default: string | null;
  notify_on_completed: boolean;
  notify_on_deferred: boolean;
  created_at: string;
  updated_at: string;
};

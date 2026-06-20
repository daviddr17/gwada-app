export type StaffTodoAssigneeType = "staff" | "position_tag";

export type StaffTodoPriority = "high" | "medium" | "low";

export type StaffTodoCompletionMode = "any_one" | "each_assignee";

export type StaffTodoDeferTrigger =
  | "clock_in"
  | "break_start"
  | "break_end"
  | "clock_out";

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

export type RestaurantStaffTodoRow = {
  id: string;
  restaurant_id: string;
  title: string;
  description: string | null;
  assignee_type: StaffTodoAssigneeType;
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
  completion_mode: StaffTodoCompletionMode;
  require_defer_reason: boolean;
  blocks_shift_end: boolean;
  sort_order: number;
  created_by: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  staff?: { id: string; given_name: string; family_name: string | null } | null;
  position_tag?: { id: string; name: string } | null;
  completions?: RestaurantStaffTodoCompletionRow[];
};

export type RestaurantStaffTodoCompletionRow = {
  id: string;
  todo_id: string;
  staff_id: string;
  completed_at: string;
  reopened_at: string | null;
  confirmed_at: string | null;
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
  assignee_type: StaffTodoAssigneeType;
  staff_id?: string | null;
  position_tag_id?: string | null;
  priority: StaffTodoPriority;
  display_from?: string | null;
  display_until?: string | null;
  show_on_display?: boolean;
  show_before_clock_in?: boolean;
  show_before_break_start?: boolean;
  show_before_break_end?: boolean;
  show_before_clock_out?: boolean;
  completion_mode?: StaffTodoCompletionMode;
  require_defer_reason?: boolean;
  blocks_shift_end?: boolean;
  sort_order?: number;
};

export type StaffTodoSettingsRow = {
  restaurant_id: string;
  defer_reason_default: string | null;
  notify_on_completed: boolean;
  notify_on_deferred: boolean;
  created_at: string;
  updated_at: string;
};

export type StaffTodoSettingsInput = {
  defer_reason_default?: string | null;
  notify_on_completed?: boolean;
  notify_on_deferred?: boolean;
};

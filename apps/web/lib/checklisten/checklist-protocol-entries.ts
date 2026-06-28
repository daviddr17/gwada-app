import {
  resolveStaffTodoLogActorLabel,
  type StaffTodoCompletionForProtocol,
  type StaffTodoLogEntryForProtocol,
} from "@/lib/supabase/staff-todos-db";
import { staffDisplayName } from "@/lib/types/staff";
import { STAFF_TODO_LOG_ACTION_LABELS } from "@/lib/types/staff-todos";
import {
  DEFAULT_RESTAURANT_TIMEZONE,
  restaurantCalendarDaysAgoStart,
  startOfRestaurantCalendarDay,
} from "@/lib/restaurant/restaurant-timezone";

export type ChecklistProtocolKind = "capture" | "change";

export type ChecklistProtocolEntry = {
  id: string;
  kind: ChecklistProtocolKind;
  at: string;
  title: string;
  areaId: string | null;
  areaName: string | null;
  areaColor: string | null;
  deviceId: string | null;
  deviceName: string | null;
  actor: string;
  actionLabel: string;
  /** Erfasster/eingegebener Wert — nicht der Aufgabenname. */
  value: string;
  withinLimits: boolean | null;
};

/** Protokoll = Erfassungen (Standard) oder ToDo-Änderungslog — je eine Tabelle, kein Merge. */
export type ChecklistProtocolKindFilter = ChecklistProtocolKind;
export type ChecklistProtocolPeriodFilter = "all" | "today" | "7d" | "30d";
export type ChecklistProtocolDeviationFilter = "all" | "deviation" | "ok";
export type ChecklistProtocolSortKey = "newest" | "oldest";

export const CHECKLIST_PROTOCOL_DEFAULT_KIND: ChecklistProtocolKindFilter = "capture";

function formatTodoCaptureValue(
  completion: StaffTodoCompletionForProtocol,
): string {
  const captureType = completion.todo.capture_type ?? "none";
  const parts: string[] = [];

  if (completion.captured_numeric != null) {
    const suffix = captureType === "temperature" ? " °C" : "";
    parts.push(`${completion.captured_numeric}${suffix}`);
  }
  if (completion.captured_text?.trim()) {
    parts.push(completion.captured_text.trim());
  }
  if (completion.corrective_action?.trim()) {
    parts.push(completion.corrective_action.trim());
  }
  if (completion.completion_note?.trim()) {
    parts.push(completion.completion_note.trim());
  }

  if (parts.length > 0) return parts.join(" · ");

  if (captureType === "boolean" || captureType === "none") {
    return "Ja";
  }

  return "—";
}

function formatStaffTodoLogProtocolValue(
  entry: StaffTodoLogEntryForProtocol,
): string {
  const d = entry.details;
  if (!d || typeof d !== "object") return "—";

  const parts: string[] = [];
  const captureType =
    typeof d.capture_type === "string" ? d.capture_type : entry.todo?.capture_type;
  const numeric =
    typeof d.captured_numeric === "number" ? d.captured_numeric : null;
  const text = typeof d.captured_text === "string" ? d.captured_text.trim() : "";

  if (numeric != null) {
    const suffix = captureType === "temperature" ? " °C" : "";
    parts.push(`${numeric}${suffix}`);
  }
  if (text) parts.push(text);

  const correctiveAction =
    typeof d.corrective_action === "string" ? d.corrective_action.trim() : "";
  if (correctiveAction) parts.push(correctiveAction);

  const reason = typeof d.reason === "string" ? d.reason.trim() : "";
  if (reason) parts.push(reason);

  const trigger = typeof d.trigger === "string" ? d.trigger.trim() : "";
  if (trigger && entry.action === "deferred") {
    parts.push(trigger);
  }

  if (parts.length > 0) return parts.join(" · ");

  if (
    entry.action === "completed" ||
    entry.action === "completed_by_manager"
  ) {
    if (!captureType || captureType === "boolean" || captureType === "none") {
      return "Ja";
    }
  }

  const name = typeof d.name === "string" ? d.name.trim() : "";
  if (name) return name;

  return "—";
}

function areaFromTodo(
  todo: StaffTodoCompletionForProtocol["todo"] | StaffTodoLogEntryForProtocol["todo"],
) {
  return {
    areaId: todo?.checklist_area_id ?? todo?.checklist_area?.id ?? null,
    areaName: todo?.checklist_area?.name ?? null,
    areaColor: todo?.checklist_area?.background_color ?? null,
    deviceId: todo?.checklist_device_id ?? todo?.checklist_device?.id ?? null,
    deviceName: todo?.checklist_device?.name ?? null,
  };
}

export function mapCompletionToChecklistProtocolEntry(
  completion: StaffTodoCompletionForProtocol,
): ChecklistProtocolEntry {
  const ctx = areaFromTodo(completion.todo);
  return {
    id: `todo-completion-${completion.id}`,
    kind: "capture",
    at: completion.completed_at,
    title: completion.todo.title,
    ...ctx,
    actor: completion.staff
      ? staffDisplayName({
          given_name: completion.staff.given_name,
          family_name: completion.staff.family_name ?? "",
        })
      : "—",
    actionLabel: "Erfassung",
    value: formatTodoCaptureValue(completion),
    withinLimits: completion.within_limits,
  };
}

export function mapCaptureLogToChecklistProtocolEntry(
  entry: StaffTodoLogEntryForProtocol,
): ChecklistProtocolEntry {
  const ctx = areaFromTodo(entry.todo);
  const d = entry.details;
  const withinLimits =
    d && typeof d === "object" && typeof d.within_limits === "boolean"
      ? d.within_limits
      : null;
  return {
    id: `todo-capture-log-${entry.id}`,
    kind: "capture",
    at: entry.created_at,
    title: entry.todo?.title ?? "—",
    ...ctx,
    actor: resolveStaffTodoLogActorLabel(entry),
    actionLabel: "Erfassung",
    value: formatStaffTodoLogProtocolValue(entry),
    withinLimits,
  };
}

export function mapTodoLogToChecklistProtocolEntry(
  entry: StaffTodoLogEntryForProtocol,
): ChecklistProtocolEntry {
  const ctx = areaFromTodo(entry.todo);
  return {
    id: `todo-log-${entry.id}`,
    kind: "change",
    at: entry.created_at,
    title: entry.todo?.title ?? "—",
    ...ctx,
    actor: resolveStaffTodoLogActorLabel(entry),
    actionLabel: STAFF_TODO_LOG_ACTION_LABELS[entry.action],
    value: formatStaffTodoLogProtocolValue(entry),
    withinLimits: null,
  };
}

function periodStart(
  period: ChecklistProtocolPeriodFilter,
  timeZone: string = DEFAULT_RESTAURANT_TIMEZONE,
  ref: Date = new Date(),
): Date | null {
  if (period === "all") return null;
  if (period === "today") return startOfRestaurantCalendarDay(ref, timeZone);
  const days = period === "7d" ? 7 : 30;
  return restaurantCalendarDaysAgoStart(days, ref, timeZone);
}

/** Untere Zeitgrenze für DB-Abfragen (null = kein Limit). */
export function getChecklistProtocolPeriodSinceIso(
  period: ChecklistProtocolPeriodFilter,
  timeZone: string = DEFAULT_RESTAURANT_TIMEZONE,
  ref: Date = new Date(),
): string | null {
  const from = periodStart(period, timeZone, ref);
  return from ? from.toISOString() : null;
}

export const CHECKLIST_PROTOCOL_DEFAULT_PERIOD: ChecklistProtocolPeriodFilter = "30d";

export function countChecklistProtocolActiveFilters(input: {
  kind: ChecklistProtocolKindFilter;
  period: ChecklistProtocolPeriodFilter;
  areaId: string;
  deviceId: string;
  deviation: ChecklistProtocolDeviationFilter;
  sortKey: ChecklistProtocolSortKey;
}): number {
  let n = 0;
  if (input.kind !== CHECKLIST_PROTOCOL_DEFAULT_KIND) n += 1;
  if (input.period !== CHECKLIST_PROTOCOL_DEFAULT_PERIOD) n += 1;
  if (input.areaId !== "all") n += 1;
  if (input.deviceId !== "all") n += 1;
  if (input.deviation !== "all") n += 1;
  if (input.sortKey !== "newest") n += 1;
  return n;
}

export const CHECKLIST_PROTOCOL_KIND_OPTIONS: {
  value: ChecklistProtocolKindFilter;
  label: string;
}[] = [
  { value: "capture", label: "Erfassungen" },
  { value: "change", label: "Änderungen" },
];

export const CHECKLIST_PROTOCOL_PERIOD_OPTIONS: {
  value: ChecklistProtocolPeriodFilter;
  label: string;
}[] = [
  { value: "all", label: "Gesamter Zeitraum" },
  { value: "today", label: "Heute" },
  { value: "7d", label: "Letzte 7 Tage" },
  { value: "30d", label: "Letzte 30 Tage" },
];

export const CHECKLIST_PROTOCOL_DEVIATION_OPTIONS: {
  value: ChecklistProtocolDeviationFilter;
  label: string;
}[] = [
  { value: "all", label: "Alle Ergebnisse" },
  { value: "deviation", label: "Nur Abweichungen" },
  { value: "ok", label: "Nur ohne Abweichung" },
];

export const CHECKLIST_PROTOCOL_SORT_OPTIONS: {
  value: ChecklistProtocolSortKey;
  label: string;
}[] = [
  { value: "newest", label: "Neueste zuerst" },
  { value: "oldest", label: "Älteste zuerst" },
];

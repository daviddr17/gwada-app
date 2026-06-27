import type { RestaurantStaffTodoRow } from "@/lib/types/staff-todos";
import {
  STAFF_TODO_CAPTURE_TYPE_LABELS,
  STAFF_TODO_RECURRENCE_LABELS,
} from "@/lib/types/staff-todos";

export function staffTodoRecurrenceLabel(
  recurrence: RestaurantStaffTodoRow["recurrence"],
): string | null {
  if (!recurrence) return null;
  return STAFF_TODO_RECURRENCE_LABELS[recurrence];
}

export function staffTodoCaptureLabel(
  captureType: RestaurantStaffTodoRow["capture_type"],
): string {
  return STAFF_TODO_CAPTURE_TYPE_LABELS[captureType];
}

export function staffTodoLimitsLabel(
  todo: Pick<RestaurantStaffTodoRow, "capture_type" | "target_min" | "target_max">,
): string | null {
  if (todo.capture_type !== "temperature" && todo.capture_type !== "number") {
    return null;
  }
  const { target_min: min, target_max: max } = todo;
  if (min != null && max != null) return `${min} – ${max}`;
  if (max != null) return `max. ${max}`;
  if (min != null) return `min. ${min}`;
  return null;
}

export function staffTodoContextLabel(
  todo: Pick<
    RestaurantStaffTodoRow,
    "checklist_device" | "checklist_area" | "checklist_device_id" | "checklist_area_id"
  >,
  areaName?: string | null,
  deviceName?: string | null,
): string | null {
  const parts: string[] = [];
  const area =
    todo.checklist_area?.name ??
    areaName ??
    (todo.checklist_area_id ? "Bereich" : null);
  const device =
    todo.checklist_device?.name ??
    deviceName ??
    (todo.checklist_device_id ? "Gerät" : null);
  if (area) parts.push(area);
  if (device) parts.push(device);
  return parts.length ? parts.join(" · ") : null;
}

export function todoMatchesAreaFilter(
  todo: Pick<
    RestaurantStaffTodoRow,
    "checklist_area_id" | "checklist_device_id" | "checklist_device"
  >,
  areaId: string,
): boolean {
  if (todo.checklist_area_id === areaId) return true;
  if (todo.checklist_device?.area_id === areaId) return true;
  return false;
}

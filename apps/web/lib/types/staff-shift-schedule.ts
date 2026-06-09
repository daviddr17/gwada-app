export type StaffScheduledShiftStatus = "confirmed" | "pending" | "declined";

export type RestaurantShiftScheduleSettingsRow = {
  restaurant_id: string;
  requires_acceptance: boolean;
  created_at: string;
  updated_at: string;
};

export type RestaurantShiftTemplateRow = {
  id: string;
  restaurant_id: string;
  name: string;
  /** HH:MM:SS */
  start_time: string;
  /** HH:MM:SS */
  end_time: string;
  color: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type RestaurantStaffScheduledShiftRow = {
  id: string;
  restaurant_id: string;
  staff_id: string;
  template_id: string | null;
  position_tag_id: string | null;
  label: string | null;
  starts_at: string;
  ends_at: string;
  status: StaffScheduledShiftStatus;
  note: string | null;
  series_id: string | null;
  responded_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  template?: Pick<RestaurantShiftTemplateRow, "id" | "name" | "color" | "start_time" | "end_time"> | null;
};

export type ShiftScheduleViewMode = "day" | "week" | "month";

export type ShiftScheduleSortKey = "name" | "hours";

export const STAFF_SCHEDULED_SHIFT_STATUS_LABELS: Record<
  StaffScheduledShiftStatus,
  string
> = {
  confirmed: "Bestätigt",
  pending: "Ausstehend",
  declined: "Abgelehnt",
};

export function scheduledShiftDisplayLabel(
  shift: Pick<RestaurantStaffScheduledShiftRow, "label">,
): string {
  const trimmed = shift.label?.trim();
  return trimmed || "Schicht";
}

export function scheduledShiftDisplayColor(
  shift: Pick<RestaurantStaffScheduledShiftRow, "template">,
): string {
  return shift.template?.color?.trim() || "#3b82f6";
}

export function formatShiftTimeDe(iso: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatShiftTimeRangeDe(startsAt: string, endsAt: string): string {
  return `${formatShiftTimeDe(startsAt)} – ${formatShiftTimeDe(endsAt)}`;
}

export function scheduledShiftDurationMinutes(
  startsAt: string,
  endsAt: string,
): number {
  return Math.max(
    0,
    Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60_000),
  );
}

export function formatScheduledHoursMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

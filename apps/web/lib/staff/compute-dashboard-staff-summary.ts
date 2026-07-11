import { listCompletedDisplayShifts } from "@/lib/staff/staff-work-hours-display";
import type {
  RestaurantStaffRow,
  RestaurantStaffWorkEntryRow,
  StaffLivePresenceRow,
} from "@/lib/types/staff";
import { formatHoursDe } from "@/lib/staff/staff-work-hours-summary";

export type DashboardStaffSummary = {
  totalStaff: number;
  activeStaff: number;
  onBreakStaff: number;
  /** Nur entry_type work — offene und geschlossene Segmente, ohne Pausen. */
  todayWorkHours: number;
  /** Abgeschlossene Display-Schichten heute. */
  completedShiftsToday: number;
};

export function computeDashboardStaffSummary(params: {
  staff: RestaurantStaffRow[];
  presence: StaffLivePresenceRow[];
  todayEntries: RestaurantStaffWorkEntryRow[];
  now?: Date;
}): DashboardStaffSummary {
  const now = params.now ?? new Date();
  let activeStaff = 0;
  let onBreakStaff = 0;
  for (const p of params.presence) {
    if (p.status === "on_break") onBreakStaff += 1;
    else if (p.status === "working") activeStaff += 1;
  }

  let workMs = 0;
  for (const e of params.todayEntries) {
    if (e.entry_type !== "work") continue;
    const startMs = new Date(e.starts_at).getTime();
    const endMs = e.is_open ? now.getTime() : new Date(e.ends_at).getTime();
    workMs += Math.max(0, endMs - startMs);
  }

  return {
    totalStaff: params.staff.filter((s) => s.is_active).length,
    activeStaff,
    onBreakStaff,
    todayWorkHours: workMs / 3_600_000,
    completedShiftsToday: listCompletedDisplayShifts(params.todayEntries).length,
  };
}

export function formatDashboardStaffTodayWorkLabel(hours: number): string {
  if (hours <= 0) return "Noch keine Arbeitszeit heute";
  return `${formatHoursDe(hours)} erfasst (Display & manuell)`;
}

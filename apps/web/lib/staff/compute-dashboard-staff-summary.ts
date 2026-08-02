import { listCompletedDisplayShifts } from "@/lib/staff/staff-work-hours-display";
import { sumTeamWorkHoursForDay } from "@/lib/staff/staff-day-wage";
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
  /** Netto-Arbeitszeit heute — geclippt auf Restaurant-Tag, Display-Netto. */
  todayWorkHours: number;
  /** Abgeschlossene Display-Schichten heute. */
  completedShiftsToday: number;
};

export function computeDashboardStaffSummary(params: {
  staff: RestaurantStaffRow[];
  presence: StaffLivePresenceRow[];
  todayEntries: RestaurantStaffWorkEntryRow[];
  /** Restaurant-Kalendertag YYYY-MM-DD. */
  dayYmd: string;
  /** Restaurant-IANA-Zeitzone (Server darf nicht auf UTC-Ambient clippen). */
  timeZone: string;
  now?: Date;
}): DashboardStaffSummary {
  const now = params.now ?? new Date();
  let activeStaff = 0;
  let onBreakStaff = 0;
  for (const p of params.presence) {
    if (p.status === "on_break") onBreakStaff += 1;
    else if (p.status === "working") activeStaff += 1;
  }

  return {
    totalStaff: params.staff.filter((s) => s.is_active).length,
    activeStaff,
    onBreakStaff,
    todayWorkHours: sumTeamWorkHoursForDay(
      params.todayEntries,
      params.dayYmd,
      now,
      params.timeZone,
    ),
    completedShiftsToday: listCompletedDisplayShifts(params.todayEntries).length,
  };
}

export function formatDashboardStaffTodayWorkLabel(hours: number): string {
  if (hours <= 0) return "Noch keine Arbeitszeit heute";
  return `${formatHoursDe(hours)} erfasst (Display & manuell)`;
}

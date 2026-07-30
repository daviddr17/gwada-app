import type { DashboardStaffSummary } from "@/lib/staff/compute-dashboard-staff-summary";
import type { StaffDayWageBreakdown } from "@/lib/staff/staff-day-wage";
import type { CompletedDisplayShift } from "@/lib/staff/staff-work-hours-display";
import type {
  RestaurantStaffRow,
  StaffLivePresenceRow,
} from "@/lib/types/staff";

export type DashboardStaffSummaryPayload = {
  summary: DashboardStaffSummary;
  staff: RestaurantStaffRow[];
  presence: StaffLivePresenceRow[];
  completedShifts: CompletedDisplayShift[];
  /** Tageslohn (Stunden × Vertrag) für heute — inkl. offener Schichten. */
  wageBreakdown: StaffDayWageBreakdown;
};

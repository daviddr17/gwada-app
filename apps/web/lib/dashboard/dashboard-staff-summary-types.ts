import type { DashboardStaffSummary } from "@/lib/staff/compute-dashboard-staff-summary";
import type { StaffDayWageBreakdown } from "@/lib/staff/staff-day-wage";
import type { CompletedDisplayShift } from "@/lib/staff/staff-work-hours-display";
import type { LaborComplianceViolation } from "@/lib/staff/labor-law/de-arbzg-rules";
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
  /** ArbZG-Hinweise (letzte 14 Tage, nur abgeschlossene Einträge). */
  laborViolations: LaborComplianceViolation[];
};

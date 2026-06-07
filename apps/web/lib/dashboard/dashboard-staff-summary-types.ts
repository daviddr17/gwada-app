import type { DashboardStaffSummary } from "@/lib/staff/compute-dashboard-staff-summary";
import type {
  RestaurantStaffRow,
  StaffLivePresenceRow,
} from "@/lib/types/staff";

export type DashboardStaffSummaryPayload = {
  summary: DashboardStaffSummary;
  staff: RestaurantStaffRow[];
  presence: StaffLivePresenceRow[];
};

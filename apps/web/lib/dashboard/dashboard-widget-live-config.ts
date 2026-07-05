import type { DashboardBatchWidgetId } from "@/lib/dashboard/dashboard-batch-widgets";
import type { DashboardContactsSummary } from "@/lib/contacts/compute-dashboard-contacts-summary";
import type { DashboardIntegrationsSummary } from "@/lib/dashboard/dashboard-integration-channels";
import type { DashboardStaffSummaryPayload } from "@/lib/dashboard/dashboard-staff-summary-types";
import type { DashboardReviewsSummary } from "@/lib/dashboard/load-dashboard-reviews-summary";
import type { DashboardInventorySummary } from "@/lib/inventory/compute-dashboard-inventory-summary";
import type { DashboardMenuSummary } from "@/lib/menu/compute-dashboard-menu-summary";
import type { DashboardReservationSummary } from "@/lib/reservations/compute-dashboard-reservation-summary";

export type DashboardWidgetLiveSummaryMap = {
  menu: DashboardMenuSummary;
  contacts: DashboardContactsSummary;
  reviews: DashboardReviewsSummary;
  integrations: DashboardIntegrationsSummary;
  staff: DashboardStaffSummaryPayload;
  inventory: DashboardInventorySummary;
  reservations: DashboardReservationSummary;
  messages: never;
};

/** Leichte Summary-Endpoints für Live-Patch (kein Full-Batch). */
export const DASHBOARD_WIDGET_LIVE_ENDPOINTS: {
  [K in Exclude<DashboardBatchWidgetId, "messages">]: string;
} = {
  menu: "/api/dashboard/menu/summary",
  contacts: "/api/dashboard/contacts/summary",
  reviews: "/api/dashboard/reviews",
  integrations: "/api/dashboard/integrations",
  staff: "/api/dashboard/staff/summary",
  inventory: "/api/dashboard/inventory/summary",
  reservations: "/api/dashboard/reservations/summary",
};

export type DashboardWidgetLiveFetchId = keyof typeof DASHBOARD_WIDGET_LIVE_ENDPOINTS;

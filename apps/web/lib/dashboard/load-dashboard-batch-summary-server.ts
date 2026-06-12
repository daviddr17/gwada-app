import "server-only";

import type { DashboardContactsSummary } from "@/lib/contacts/compute-dashboard-contacts-summary";
import type { MessagesUnreadSummary } from "@/lib/contact-messages/messages-unread-summary";
import type { DashboardIntegrationsSummary } from "@/lib/dashboard/dashboard-integration-channels";
import type { DashboardStaffSummaryPayload } from "@/lib/dashboard/dashboard-staff-summary-types";
import {
  type DashboardBatchWidgetId,
  isDashboardBatchWidgetId,
} from "@/lib/dashboard/dashboard-batch-widgets";
import { fetchDashboardIntegrationsSummary } from "@/lib/dashboard/fetch-dashboard-integrations-summary";
import { loadDashboardContactsSummaryServer } from "@/lib/dashboard/load-dashboard-contacts-summary-server";
import { loadDashboardInventorySummaryServer } from "@/lib/dashboard/load-dashboard-inventory-summary-server";
import { loadDashboardMenuSummaryServer } from "@/lib/dashboard/load-dashboard-menu-summary-server";
import { loadDashboardMessagesSummaryServer } from "@/lib/dashboard/load-dashboard-messages-summary-server";
import { loadDashboardReservationSummaryServer } from "@/lib/dashboard/load-dashboard-reservation-summary-server";
import type { DashboardReviewsSummary } from "@/lib/dashboard/load-dashboard-reviews-summary";
import { loadDashboardReviewsSummary } from "@/lib/dashboard/load-dashboard-reviews-summary";
import { loadDashboardStaffSummaryServer } from "@/lib/dashboard/load-dashboard-staff-summary-server";
import type { DashboardInventorySummary } from "@/lib/inventory/compute-dashboard-inventory-summary";
import type { DashboardMenuSummary } from "@/lib/menu/compute-dashboard-menu-summary";
import type { DashboardReservationSummary } from "@/lib/reservations/compute-dashboard-reservation-summary";
import type { SupabaseClient } from "@supabase/supabase-js";

export type DashboardBatchSummary = {
  menu?: DashboardMenuSummary;
  reservations?: DashboardReservationSummary;
  reviews?: DashboardReviewsSummary;
  staff?: DashboardStaffSummaryPayload;
  contacts?: DashboardContactsSummary;
  messages?: MessagesUnreadSummary;
  integrations?: DashboardIntegrationsSummary;
  inventory?: DashboardInventorySummary;
};

export type DashboardBatchSummaryErrors = Partial<
  Record<DashboardBatchWidgetId, string>
>;

export async function loadDashboardBatchSummaryServer(
  sb: SupabaseClient,
  restaurantId: string,
  userId: string,
  widgets: readonly DashboardBatchWidgetId[],
): Promise<{ data: DashboardBatchSummary; errors: DashboardBatchSummaryErrors }> {
  const unique = [...new Set(widgets.filter(isDashboardBatchWidgetId))];
  const data: DashboardBatchSummary = {};
  const errors: DashboardBatchSummaryErrors = {};

  await Promise.all(
    unique.map(async (widget) => {
      try {
        switch (widget) {
          case "menu":
            data.menu = await loadDashboardMenuSummaryServer(sb, restaurantId);
            break;
          case "reservations":
            data.reservations = await loadDashboardReservationSummaryServer(
              sb,
              restaurantId,
            );
            break;
          case "reviews":
            data.reviews = await loadDashboardReviewsSummary(
              restaurantId,
              userId,
              sb,
            );
            break;
          case "staff":
            data.staff = await loadDashboardStaffSummaryServer(sb, restaurantId);
            break;
          case "contacts":
            data.contacts = await loadDashboardContactsSummaryServer(
              sb,
              restaurantId,
            );
            break;
          case "messages":
            data.messages = await loadDashboardMessagesSummaryServer(
              restaurantId,
              userId,
            );
            break;
          case "integrations":
            data.integrations = await fetchDashboardIntegrationsSummary(
              sb,
              restaurantId,
            );
            break;
          case "inventory":
            data.inventory = await loadDashboardInventorySummaryServer(
              sb,
              restaurantId,
            );
            break;
        }
      } catch (e) {
        errors[widget] = e instanceof Error ? e.message : "load_failed";
      }
    }),
  );

  return { data, errors };
}

import "server-only";

import type { DashboardContactsSummary } from "@/lib/contacts/compute-dashboard-contacts-summary";
import type { MessagesUnreadSummary } from "@/lib/contact-messages/messages-unread-summary";
import type { DashboardIntegrationsSummary } from "@/lib/dashboard/dashboard-integration-channels";
import type { DashboardStaffSummaryPayload } from "@/lib/dashboard/dashboard-staff-summary-types";
import {
  type DashboardBatchWidgetId,
  isDashboardBatchWidgetId,
} from "@/lib/dashboard/dashboard-batch-widgets";
import type {
  DashboardAccountingSummary,
  DashboardChecklistsSummary,
  DashboardDocumentsSummary,
  DashboardEventsSummary,
  DashboardGallerySummary,
  DashboardInsightsSummary,
  DashboardNewsSummary,
  DashboardPosSummary,
} from "@/lib/dashboard/dashboard-module-summary-types";
import { fetchDashboardIntegrationsSummary } from "@/lib/dashboard/fetch-dashboard-integrations-summary";
import { loadDashboardAccountingSummaryServer } from "@/lib/dashboard/load-dashboard-accounting-summary-server";
import { loadDashboardChecklistsSummaryServer } from "@/lib/dashboard/load-dashboard-checklists-summary-server";
import { loadDashboardContactsSummaryServer } from "@/lib/dashboard/load-dashboard-contacts-summary-server";
import { loadDashboardDocumentsSummaryServer } from "@/lib/dashboard/load-dashboard-documents-summary-server";
import { loadDashboardEventsSummaryServer } from "@/lib/dashboard/load-dashboard-events-summary-server";
import { loadDashboardGallerySummaryServer } from "@/lib/dashboard/load-dashboard-gallery-summary-server";
import { loadDashboardInsightsSummaryServer } from "@/lib/dashboard/load-dashboard-insights-summary-server";
import { loadDashboardInventorySummaryServer } from "@/lib/dashboard/load-dashboard-inventory-summary-server";
import { loadDashboardMenuSummaryServer } from "@/lib/dashboard/load-dashboard-menu-summary-server";
import { loadDashboardMessagesSummaryServer } from "@/lib/dashboard/load-dashboard-messages-summary-server";
import { loadDashboardNewsSummaryServer } from "@/lib/dashboard/load-dashboard-news-summary-server";
import { loadDashboardPosSummaryServer } from "@/lib/dashboard/load-dashboard-pos-summary-server";
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
  pos?: DashboardPosSummary;
  events?: DashboardEventsSummary;
  news?: DashboardNewsSummary;
  insights?: DashboardInsightsSummary;
  gallery?: DashboardGallerySummary;
  accounting?: DashboardAccountingSummary;
  documents?: DashboardDocumentsSummary;
  checklists?: DashboardChecklistsSummary;
};

export type DashboardBatchSummaryErrors = Partial<
  Record<DashboardBatchWidgetId, string>
>;

export type DashboardBatchWidgetResult<
  K extends DashboardBatchWidgetId = DashboardBatchWidgetId,
> = {
  widget: K;
  data?: DashboardBatchSummary[K];
  error?: string;
};

async function loadDashboardBatchWidgetServer(
  sb: SupabaseClient,
  restaurantId: string,
  userId: string,
  widget: DashboardBatchWidgetId,
): Promise<DashboardBatchWidgetResult> {
  switch (widget) {
    case "menu":
      return {
        widget,
        data: await loadDashboardMenuSummaryServer(sb, restaurantId),
      };
    case "reservations":
      return {
        widget,
        data: await loadDashboardReservationSummaryServer(sb, restaurantId),
      };
    case "reviews":
      return {
        widget,
        data: await loadDashboardReviewsSummary(restaurantId, userId, sb),
      };
    case "staff":
      return {
        widget,
        data: await loadDashboardStaffSummaryServer(sb, restaurantId),
      };
    case "contacts":
      return {
        widget,
        data: await loadDashboardContactsSummaryServer(sb, restaurantId),
      };
    case "messages":
      return {
        widget,
        data: await loadDashboardMessagesSummaryServer(restaurantId, userId),
      };
    case "integrations":
      return {
        widget,
        data: await fetchDashboardIntegrationsSummary(sb, restaurantId),
      };
    case "inventory":
      return {
        widget,
        data: await loadDashboardInventorySummaryServer(sb, restaurantId),
      };
    case "pos":
      return {
        widget,
        data: await loadDashboardPosSummaryServer(sb, restaurantId),
      };
    case "events":
      return {
        widget,
        data: await loadDashboardEventsSummaryServer(sb, restaurantId),
      };
    case "news":
      return {
        widget,
        data: await loadDashboardNewsSummaryServer(sb, restaurantId),
      };
    case "insights":
      return {
        widget,
        data: await loadDashboardInsightsSummaryServer(sb, restaurantId),
      };
    case "gallery":
      return {
        widget,
        data: await loadDashboardGallerySummaryServer(sb, restaurantId),
      };
    case "accounting":
      return {
        widget,
        data: await loadDashboardAccountingSummaryServer(sb, restaurantId),
      };
    case "documents":
      return {
        widget,
        data: await loadDashboardDocumentsSummaryServer(sb, restaurantId),
      };
    case "checklists":
      return {
        widget,
        data: await loadDashboardChecklistsSummaryServer(sb, restaurantId),
      };
  }
}

export async function loadDashboardBatchSummaryServer(
  sb: SupabaseClient,
  restaurantId: string,
  userId: string,
  widgets: readonly DashboardBatchWidgetId[],
  options?: {
    /** Pro fertigem Widget — für NDJSON-Streaming (Time-to-first-KPI). */
    onWidget?: (result: DashboardBatchWidgetResult) => void;
  },
): Promise<{ data: DashboardBatchSummary; errors: DashboardBatchSummaryErrors }> {
  const unique = [...new Set(widgets.filter(isDashboardBatchWidgetId))];
  const data: DashboardBatchSummary = {};
  const errors: DashboardBatchSummaryErrors = {};

  await Promise.all(
    unique.map(async (widget) => {
      try {
        const result = await loadDashboardBatchWidgetServer(
          sb,
          restaurantId,
          userId,
          widget,
        );
        if (result.data !== undefined) {
          Object.assign(data, { [widget]: result.data });
        }
        options?.onWidget?.(result);
      } catch (e) {
        const error = e instanceof Error ? e.message : "load_failed";
        errors[widget] = error;
        options?.onWidget?.({ widget, error });
      }
    }),
  );

  return { data, errors };
}

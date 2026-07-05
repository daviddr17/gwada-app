"use client";

import {
  dispatchDashboardReservationsLiveInsert,
  dispatchDashboardReservationsLiveUpdate,
} from "@/lib/dashboard/dashboard-live-events";
import type { ReservationLiveInsertFields } from "@/lib/dashboard/patch-dashboard-reservations-live-client";
import { dispatchDashboardWidgetLiveFetch } from "@/lib/dashboard/dashboard-widgets-live-events";

/** Eigene Reservierung angelegt — KPI sofort patchen (ohne Realtime-Roundtrip). */
export function dispatchDashboardReservationCreateLivePatch(params: {
  restaurantId: string;
  insert: ReservationLiveInsertFields;
}): void {
  dispatchDashboardReservationsLiveInsert(params);
  dispatchDashboardWidgetLiveFetch(params.restaurantId, "contacts", {
    immediate: true,
  });
}

/** Eigene Reservierung geändert — KPI sofort nachziehen. */
export function dispatchDashboardReservationUpdateLivePatch(
  restaurantId: string,
): void {
  dispatchDashboardReservationsLiveUpdate({
    restaurantId,
    immediate: true,
  });
}

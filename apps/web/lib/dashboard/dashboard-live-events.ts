/** Dashboard-Widgets nach Realtime-Hinweis leicht aktualisieren (kein Voll-Polling). */
export const GWADA_DASHBOARD_MESSAGES_REFRESH_EVENT =
  "gwada:dashboard-messages-refresh";

export type DashboardMessagesRefreshDetail = {
  restaurantId: string;
  /** Einzelne Konversation als gelesen — optimistisches Dashboard-Patch. */
  contactId?: string;
  /** Alle Nachrichten gelesen — optimistisches Dashboard-Patch. */
  all?: boolean;
};

export type DashboardReservationsLiveInsertDetail = {
  restaurantId: string;
  insert: import("@/lib/dashboard/patch-dashboard-reservations-live-client").ReservationLiveInsertFields;
};

export const GWADA_DASHBOARD_RESERVATIONS_LIVE_INSERT_EVENT =
  "gwada:dashboard-reservations-live-insert";

export function dispatchDashboardReservationsLiveInsert(
  detail: DashboardReservationsLiveInsertDetail,
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(GWADA_DASHBOARD_RESERVATIONS_LIVE_INSERT_EVENT, {
      detail,
    }),
  );
}

export function dispatchDashboardMessagesRefresh(
  detail?: DashboardMessagesRefreshDetail,
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(GWADA_DASHBOARD_MESSAGES_REFRESH_EVENT, { detail }),
  );
}

/** Nur WAHA-ACK/Reactions mergen — kein vollständiger Thread-Reload. */
export const GWADA_DASHBOARD_WAHA_METADATA_REFRESH_EVENT =
  "gwada:dashboard-waha-metadata-refresh";
export const GWADA_DASHBOARD_RESERVATIONS_REFRESH_EVENT =
  "gwada:dashboard-reservations-refresh";

export function dispatchDashboardWahaMetadataRefresh(): void {
  window.dispatchEvent(new Event(GWADA_DASHBOARD_WAHA_METADATA_REFRESH_EVENT));
}

export function dispatchDashboardReservationsRefresh(): void {
  window.dispatchEvent(new Event(GWADA_DASHBOARD_RESERVATIONS_REFRESH_EVENT));
}

/** Status/Tisch/Update — debounced Summary-Fetch, kein Full-Batch. */
export const GWADA_DASHBOARD_RESERVATIONS_LIVE_UPDATE_EVENT =
  "gwada:dashboard-reservations-live-update";

export type DashboardReservationsLiveUpdateDetail = {
  restaurantId: string;
  /** Eigene Speicher-Aktion — Summary sofort, ohne Debounce. */
  immediate?: boolean;
};

export function dispatchDashboardReservationsLiveUpdate(
  detail: DashboardReservationsLiveUpdateDetail,
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(GWADA_DASHBOARD_RESERVATIONS_LIVE_UPDATE_EVENT, { detail }),
  );
}

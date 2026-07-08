/** Display-Reservierungsliste nach Live-Hinweis (Polling) aktualisieren. */
export const GWADA_DISPLAY_RESERVATIONS_REFRESH_EVENT =
  "gwada:display-reservations-refresh";

/** Sofort-Check nach PIN-Anmeldung / Entsperren (Auto-Sperre). */
export const GWADA_DISPLAY_RESERVATIONS_LIVE_SYNC_EVENT =
  "gwada:display-reservations-live-sync";

/** Optimistisches Einfügen — Zeile sofort in Tagesliste (vor stiller Reconciliation). */
export const GWADA_DISPLAY_RESERVATIONS_LIVE_INSERT_EVENT =
  "gwada:display-reservations-live-insert";

/** Eigene Anlage (Drawer/Sprache) — Live-Polling soll keinen zweiten Toast senden. */
export const GWADA_DISPLAY_RESERVATIONS_OWN_CREATE_EVENT =
  "gwada:display-reservations-own-create";

export type DisplayReservationsLiveInsertDetail = {
  row: import("@/lib/display/display-reservations-server").DisplayReservationRow;
  latestCreatedAt: string;
};

export type DisplayReservationsOwnCreateDetail = {
  reservationId: string;
};

export function dispatchDisplayReservationsRefresh(): void {
  window.dispatchEvent(new Event(GWADA_DISPLAY_RESERVATIONS_REFRESH_EVENT));
}

export function dispatchDisplayReservationsLiveInsert(
  detail: DisplayReservationsLiveInsertDetail,
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(GWADA_DISPLAY_RESERVATIONS_LIVE_INSERT_EVENT, { detail }),
  );
}

/** Nach manueller Anlage im Display — unterdrückt den Live-„Neue Reservierung“-Toast. */
export function notifyDisplayReservationOwnCreate(
  detail: DisplayReservationsOwnCreateDetail,
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(GWADA_DISPLAY_RESERVATIONS_OWN_CREATE_EVENT, { detail }),
  );
}

/** Liste + Live-Signal-Baseline nach PIN (ohne Warten auf Intervall). */
export function syncDisplayReservationsLiveAfterPin(): void {
  dispatchDisplayReservationsRefresh();
  window.dispatchEvent(new Event(GWADA_DISPLAY_RESERVATIONS_LIVE_SYNC_EVENT));
}

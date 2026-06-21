/** Display-ToDo-Badge nach Live-Hinweis (Polling) aktualisieren. */
export const GWADA_DISPLAY_TODOS_REFRESH_EVENT = "gwada:display-todos-refresh";

/** Sofort-Check nach PIN-Anmeldung / Entsperren. */
export const GWADA_DISPLAY_TODOS_LIVE_SYNC_EVENT = "gwada:display-todos-live-sync";

export function dispatchDisplayTodosRefresh(): void {
  window.dispatchEvent(new Event(GWADA_DISPLAY_TODOS_REFRESH_EVENT));
}

export function syncDisplayTodosLiveAfterPin(): void {
  dispatchDisplayTodosRefresh();
  window.dispatchEvent(new Event(GWADA_DISPLAY_TODOS_LIVE_SYNC_EVENT));
}

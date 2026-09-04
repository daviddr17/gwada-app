export const GWADA_MENU_DATA_REFRESH_EVENT = "gwada:menu-data-refresh";

export function dispatchMenuDataRefresh(): void {
  window.dispatchEvent(new Event(GWADA_MENU_DATA_REFRESH_EVENT));
}

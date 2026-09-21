export const GWADA_DINING_DATA_REFRESH_EVENT = "gwada:dining-data-refresh";

export function dispatchDiningDataRefresh(): void {
  window.dispatchEvent(new Event(GWADA_DINING_DATA_REFRESH_EVENT));
}

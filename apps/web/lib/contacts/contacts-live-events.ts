export const GWADA_CONTACTS_DATA_REFRESH_EVENT = "gwada:contacts-data-refresh";

export function dispatchContactsDataRefresh(): void {
  window.dispatchEvent(new Event(GWADA_CONTACTS_DATA_REFRESH_EVENT));
}

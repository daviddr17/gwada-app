import { dispatchStaffDataRefresh } from "@/lib/staff/staff-live-events";

export const STAFF_CONTRACTS_UPDATED_EVENT = "staff-contracts-updated";

export function notifyStaffContractsUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(STAFF_CONTRACTS_UPDATED_EVENT));
  dispatchStaffDataRefresh();
}

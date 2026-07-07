import type { StaffPresenceStatus } from "@/lib/types/staff";

export const STAFF_PRESENCE_STATUS_LABELS: Record<StaffPresenceStatus, string> = {
  working: "In Schicht",
  on_break: "Pause",
  off: "—",
};

export function staffPresenceStatusForRow(
  staffId: string,
  workingIds: Set<string>,
  breakIds: Set<string>,
): StaffPresenceStatus {
  if (breakIds.has(staffId)) return "on_break";
  if (workingIds.has(staffId)) return "working";
  return "off";
}

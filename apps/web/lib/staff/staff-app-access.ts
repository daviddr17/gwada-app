import type { RestaurantStaffRow } from "@/lib/types/staff";
import { formatLinkedProfileLabel } from "@/lib/staff/format-linked-profile-label";

export type StaffAppAccessState = "none" | "active" | "revoked";

export type StaffAppAccessFields = Pick<
  RestaurantStaffRow,
  "profile_id" | "linked_profile" | "linked_employee"
>;

export function resolveStaffAppAccessState(
  row: StaffAppAccessFields,
): StaffAppAccessState {
  if (!row.profile_id) return "none";
  if (row.linked_employee?.is_active === false) return "revoked";
  return "active";
}

export function staffAppAccessProfileLabel(
  row: StaffAppAccessFields,
): string | null {
  if (!row.profile_id) return null;
  const label = formatLinkedProfileLabel(row.linked_profile);
  return label !== "—" ? label : null;
}

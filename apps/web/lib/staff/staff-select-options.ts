import type { SearchableSelectOption } from "@/components/ui/combobox";
import type { RestaurantStaffRow } from "@/lib/types/staff";
import { staffFamilyFirstDisplayName } from "@/lib/types/staff";

export type BuildStaffSelectOptionsParams = {
  /** Default true — dropdowns list only active staff. */
  activeOnly?: boolean;
  /** Keep these IDs visible even when inactive (e.g. existing assignment). */
  includeStaffIds?: readonly (string | null | undefined)[];
  /** Append "(inaktiv)" when an inactive row is included. Default true. */
  showInactiveSuffix?: boolean;
};

export function staffSelectOptionLabel(
  row: RestaurantStaffRow,
  showInactiveSuffix = true,
): string {
  const name = staffFamilyFirstDisplayName(row);
  if (showInactiveSuffix && !row.is_active) return `${name} (inaktiv)`;
  return name;
}

export function filterStaffForSelect(
  staffList: readonly RestaurantStaffRow[],
  params: BuildStaffSelectOptionsParams = {},
): RestaurantStaffRow[] {
  const {
    activeOnly = true,
    includeStaffIds = [],
  } = params;
  if (!activeOnly) return [...staffList];

  const includeSet = new Set(
    includeStaffIds.filter((id): id is string => Boolean(id)),
  );
  return staffList.filter((s) => s.is_active || includeSet.has(s.id));
}

export function buildStaffSearchableSelectOptions(
  staffList: readonly RestaurantStaffRow[],
  params: BuildStaffSelectOptionsParams = {},
): SearchableSelectOption[] {
  const { showInactiveSuffix = true, ...filterParams } = params;
  return filterStaffForSelect(staffList, filterParams).map((s) => ({
    value: s.id,
    label: staffSelectOptionLabel(s, showInactiveSuffix),
    leadingColor: s.position_tag?.background_color,
  }));
}

/** Nur gespeicherte Auswahl wiederherstellen — kein Fallback auf ersten Mitarbeiter. */
export function pickStoredActiveStaffId(
  staffList: readonly RestaurantStaffRow[],
  preferredId?: string | null,
): string | null {
  if (!preferredId) return null;
  const preferred = staffList.find((s) => s.id === preferredId);
  if (preferred?.is_active) return preferredId;
  return null;
}

/** @deprecated Kein Auto-Fallback mehr — {@link pickStoredActiveStaffId} nutzen. */
export function pickDefaultActiveStaffId(
  staffList: readonly RestaurantStaffRow[],
  preferredId?: string | null,
): string | null {
  return pickStoredActiveStaffId(staffList, preferredId);
}

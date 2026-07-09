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

export const STAFF_MODULE_ALL_VALUE = "__all__";

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

/** Sticky-Bar: „Alle Mitarbeiter“ als zurücksetzbare erste Option. */
export function buildStaffModulePickerOptions(
  staffList: readonly RestaurantStaffRow[],
  params: BuildStaffSelectOptionsParams & {
    allowAll?: boolean;
    allLabel?: string;
  } = {},
): SearchableSelectOption[] {
  const { allowAll = false, allLabel = "Alle Mitarbeiter", ...filterParams } =
    params;
  const staffOptions = buildStaffSearchableSelectOptions(staffList, filterParams);
  if (!allowAll) return staffOptions;
  return [
    { value: STAFF_MODULE_ALL_VALUE, label: allLabel },
    ...staffOptions,
  ];
}

export function staffModulePickerSelectValue(
  selectedStaffId: string | null,
  allowAll: boolean,
): string {
  if (selectedStaffId) return selectedStaffId;
  return allowAll ? STAFF_MODULE_ALL_VALUE : "";
}

export function staffModulePickerIdFromSelectValue(
  value: string,
  allowAll: boolean,
): string | null {
  if (!value || (allowAll && value === STAFF_MODULE_ALL_VALUE)) return null;
  return value;
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

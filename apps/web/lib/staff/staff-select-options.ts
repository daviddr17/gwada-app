import type { SearchableSelectOption } from "@/components/ui/combobox";
import type { RestaurantStaffRow } from "@/lib/types/staff";
import { staffDisplayName } from "@/lib/types/staff";

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
  const name = staffDisplayName(row);
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

/** Prefer stored/active selection; never fall back to an inactive employee. */
export function pickDefaultActiveStaffId(
  staffList: readonly RestaurantStaffRow[],
  preferredId?: string | null,
): string | null {
  if (preferredId) {
    const preferred = staffList.find((s) => s.id === preferredId);
    if (preferred?.is_active) return preferredId;
  }
  return staffList.find((s) => s.is_active)?.id ?? null;
}

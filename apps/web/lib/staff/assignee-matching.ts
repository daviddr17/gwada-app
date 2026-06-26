export type StaffAssigneeLink = {
  staff_id: string;
  staff?: {
    id: string;
    given_name: string;
    family_name: string | null;
  } | null;
};

export type PositionAssigneeLink = {
  position_tag_id: string;
  position_tag?: { id: string; name: string } | null;
};

export type MultiAssigneeSource = {
  staff_id?: string | null;
  position_tag_id?: string | null;
  staff_assignees?: StaffAssigneeLink[] | null;
  position_assignees?: PositionAssigneeLink[] | null;
};

export function assignedStaffIds(source: MultiAssigneeSource): string[] {
  const fromLinks = (source.staff_assignees ?? []).map((a) => a.staff_id);
  if (fromLinks.length > 0) return fromLinks;
  if (source.staff_id) return [source.staff_id];
  return [];
}

export function assignedPositionTagIds(source: MultiAssigneeSource): string[] {
  const fromLinks = (source.position_assignees ?? []).map((a) => a.position_tag_id);
  if (fromLinks.length > 0) return fromLinks;
  if (source.position_tag_id) return [source.position_tag_id];
  return [];
}

/** Leere Listen = alle (Eigenkontrolle). Für ToDos mindestens eine Zuweisung erforderlich. */
export function isAssignedToStaffMember(
  source: MultiAssigneeSource,
  staffId: string,
  positionTagId: string | null,
  options?: { emptyMeansAll?: boolean },
): boolean {
  const staffIds = assignedStaffIds(source);
  const tagIds = assignedPositionTagIds(source);
  const emptyMeansAll = options?.emptyMeansAll ?? true;

  if (staffIds.length === 0 && tagIds.length === 0) {
    return emptyMeansAll;
  }
  if (staffIds.includes(staffId)) return true;
  if (positionTagId && tagIds.includes(positionTagId)) return true;
  return false;
}

export function formatAssigneeLabels(
  source: MultiAssigneeSource,
  formatStaffName: (staff: {
    given_name: string;
    family_name: string | null;
  }) => string,
): string {
  const staffLabels = (source.staff_assignees ?? [])
    .map((a) =>
      a.staff
        ? formatStaffName(a.staff)
        : assignedStaffIds(source).includes(a.staff_id)
          ? "Mitarbeiter"
          : null,
    )
    .filter(Boolean) as string[];

  if (staffLabels.length === 0) {
    const ids = assignedStaffIds(source);
    if (ids.length === 1 && source.staff) {
      staffLabels.push(formatStaffName(source.staff));
    }
  }

  const tagLabels = (source.position_assignees ?? [])
    .map((a) => a.position_tag?.name ?? null)
    .filter(Boolean) as string[];

  if (tagLabels.length === 0 && source.position_tag?.name) {
    tagLabels.push(source.position_tag.name);
  }

  const parts = [...staffLabels, ...tagLabels];
  if (parts.length === 0) return "Alle Mitarbeiter";
  return parts.join(", ");
}

export function inferLegacyAssigneeType(
  staffIds: string[],
  positionTagIds: string[],
): "staff" | "position_tag" | "mixed" | null {
  if (staffIds.length === 0 && positionTagIds.length === 0) return null;
  if (staffIds.length > 0 && positionTagIds.length > 0) return "mixed";
  if (staffIds.length > 0) return "staff";
  return "position_tag";
}

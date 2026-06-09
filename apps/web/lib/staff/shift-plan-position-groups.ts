import type { RestaurantStaffRow } from "@/lib/types/staff";
import type { StaffPositionTagDefinition } from "@/lib/types/staff";

export type ShiftPlanPositionGroup = {
  id: string | null;
  name: string;
  color: string;
  staff: RestaurantStaffRow[];
};

const UNASSIGNED_COLOR = "#64748b";

export function groupStaffByPositionTag(
  staffRows: RestaurantStaffRow[],
  positionTags: StaffPositionTagDefinition[],
): ShiftPlanPositionGroup[] {
  const tagById = new Map(positionTags.map((t) => [t.id, t]));
  const buckets = new Map<string | null, RestaurantStaffRow[]>();

  for (const staff of staffRows) {
    const key = staff.position_tag_id;
    const list = buckets.get(key) ?? [];
    list.push(staff);
    buckets.set(key, list);
  }

  const groups: ShiftPlanPositionGroup[] = [];

  for (const tag of positionTags) {
    if (!tag.active) continue;
    const staff = buckets.get(tag.id);
    if (!staff?.length) continue;
    groups.push({
      id: tag.id,
      name: tag.name,
      color: tag.backgroundColor,
      staff,
    });
    buckets.delete(tag.id);
  }

  for (const [tagId, staff] of buckets) {
    if (!staff.length) continue;
    const tag = tagId ? tagById.get(tagId) : null;
    groups.push({
      id: tagId,
      name: tag?.name ?? "Ohne Position",
      color: tag?.backgroundColor ?? UNASSIGNED_COLOR,
      staff,
    });
  }

  return groups;
}

export function positionGroupHeaderStyle(color: string): {
  borderColor: string;
  backgroundColor: string;
} {
  return {
    borderColor: `${color}44`,
    backgroundColor: `${color}16`,
  };
}

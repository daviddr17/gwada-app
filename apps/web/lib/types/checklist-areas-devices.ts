export type ChecklistAreaDefinition = {
  id: string;
  name: string;
  active: boolean;
  backgroundColor: string;
};

export type RestaurantChecklistAreaRow = {
  id: string;
  restaurant_id: string;
  name: string;
  background_color: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type RestaurantChecklistDeviceRow = {
  id: string;
  restaurant_id: string;
  name: string;
  area_id: string | null;
  target_min: number | null;
  target_max: number | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  area?: { id: string; name: string; background_color: string } | null;
};

export type ChecklistDeviceUpsertInput = {
  name: string;
  areaId?: string | null;
  targetMin?: number | null;
  targetMax?: number | null;
  isActive?: boolean;
};

export const CHECKLIST_AREA_DEFAULT_COLOR = "#64748b";

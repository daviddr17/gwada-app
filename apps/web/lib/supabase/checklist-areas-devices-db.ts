import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isMissingSchemaError } from "@/lib/supabase/schema-error";
import type {
  ChecklistAreaDefinition,
  ChecklistDeviceUpsertInput,
  RestaurantChecklistAreaRow,
  RestaurantChecklistDeviceRow,
} from "@/lib/types/checklist-areas-devices";
import { CHECKLIST_AREA_DEFAULT_COLOR } from "@/lib/types/checklist-areas-devices";

const HEX = /^#[0-9A-Fa-f]{6}$/;

function mapAreaRow(row: RestaurantChecklistAreaRow): ChecklistAreaDefinition {
  return {
    id: row.id,
    name: row.name,
    active: row.is_active,
    backgroundColor: HEX.test(row.background_color)
      ? row.background_color
      : CHECKLIST_AREA_DEFAULT_COLOR,
  };
}

const DEVICE_SELECT = `
  *,
  area:restaurant_checklist_areas (
    id,
    name,
    background_color
  )
`;

export async function loadChecklistAreas(
  restaurantId: string,
): Promise<{ data: ChecklistAreaDefinition[]; error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("restaurant_checklist_areas")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true });
  if (error) {
    if (isMissingSchemaError(error.message)) return { data: [], error: null };
    return { data: [], error: error.message };
  }
  return {
    data: (data as RestaurantChecklistAreaRow[]).map(mapAreaRow),
    error: null,
  };
}

export async function insertChecklistArea(
  restaurantId: string,
  name: string,
  active: boolean,
  backgroundColor: string,
): Promise<{ id: string } | null> {
  const supabase = createSupabaseBrowserClient();
  const { data: last } = await supabase
    .from("restaurant_checklist_areas")
    .select("sort_order")
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = ((last as { sort_order?: number } | null)?.sort_order ?? -1) + 1;
  const { data, error } = await supabase
    .from("restaurant_checklist_areas")
    .insert({
      restaurant_id: restaurantId,
      name: name.trim(),
      is_active: active,
      background_color: HEX.test(backgroundColor)
        ? backgroundColor
        : CHECKLIST_AREA_DEFAULT_COLOR,
      sort_order: sortOrder,
    })
    .select("id")
    .single();
  if (error || !data) return null;
  return { id: data.id as string };
}

export async function updateChecklistArea(
  id: string,
  updates: { name?: string; active?: boolean; backgroundColor?: string },
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  const patch: Record<string, unknown> = {};
  if (updates.name !== undefined) patch.name = updates.name.trim();
  if (updates.active !== undefined) patch.is_active = updates.active;
  if (updates.backgroundColor !== undefined) {
    patch.background_color = HEX.test(updates.backgroundColor)
      ? updates.backgroundColor
      : CHECKLIST_AREA_DEFAULT_COLOR;
  }
  if (Object.keys(patch).length === 0) return true;
  const { error } = await supabase
    .from("restaurant_checklist_areas")
    .update(patch)
    .eq("id", id);
  return !error;
}

export async function deleteChecklistArea(
  restaurantId: string,
  id: string,
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("restaurant_checklist_areas")
    .delete()
    .eq("restaurant_id", restaurantId)
    .eq("id", id);
  return !error;
}

export async function reorderChecklistAreas(
  orderedIds: string[],
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("restaurant_checklist_areas")
      .update({ sort_order: i })
      .eq("id", orderedIds[i]);
    if (error) return false;
  }
  return true;
}

export async function fetchChecklistDevices(
  restaurantId: string,
): Promise<{ data: RestaurantChecklistDeviceRow[]; error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("restaurant_checklist_devices")
    .select(DEVICE_SELECT)
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true });
  if (error) {
    if (isMissingSchemaError(error.message)) return { data: [], error: null };
    return { data: [], error: error.message };
  }
  return {
    data: (data ?? []) as RestaurantChecklistDeviceRow[],
    error: null,
  };
}

export async function upsertChecklistDevice(
  restaurantId: string,
  input: ChecklistDeviceUpsertInput,
  deviceId?: string | null,
): Promise<{ data: RestaurantChecklistDeviceRow | null; error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const payload = {
    restaurant_id: restaurantId,
    name: input.name.trim(),
    area_id: input.areaId ?? null,
    target_min: input.targetMin ?? null,
    target_max: input.targetMax ?? null,
    is_active: input.isActive ?? true,
  };

  const { data, error } = deviceId
    ? await supabase
        .from("restaurant_checklist_devices")
        .update(payload)
        .eq("id", deviceId)
        .eq("restaurant_id", restaurantId)
        .select(DEVICE_SELECT)
        .single()
    : await (async () => {
        const { data: last } = await supabase
          .from("restaurant_checklist_devices")
          .select("sort_order")
          .eq("restaurant_id", restaurantId)
          .order("sort_order", { ascending: false })
          .limit(1)
          .maybeSingle();
        const sortOrder =
          ((last as { sort_order?: number } | null)?.sort_order ?? -1) + 1;
        return supabase
          .from("restaurant_checklist_devices")
          .insert({ ...payload, sort_order: sortOrder })
          .select(DEVICE_SELECT)
          .single();
      })();

  return {
    data: (data as RestaurantChecklistDeviceRow | null) ?? null,
    error: error?.message ?? null,
  };
}

export async function deleteChecklistDevice(
  restaurantId: string,
  id: string,
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("restaurant_checklist_devices")
    .delete()
    .eq("restaurant_id", restaurantId)
    .eq("id", id);
  return !error;
}

export async function reorderChecklistDevices(
  orderedIds: string[],
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("restaurant_checklist_devices")
      .update({ sort_order: i })
      .eq("id", orderedIds[i]);
    if (error) return false;
  }
  return true;
}

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type PosVoidReason = {
  id: string;
  name: string;
  restoreInventory: boolean;
  sortOrder: number;
  isActive: boolean;
};

const DEFAULT_REASONS: Array<{
  name: string;
  restoreInventory: boolean;
  sortOrder: number;
}> = [
  { name: "Falsch bestellt", restoreInventory: true, sortOrder: 0 },
  { name: "Gast storniert", restoreInventory: true, sortOrder: 1 },
  { name: "Bereits ausgegeben", restoreInventory: false, sortOrder: 2 },
  { name: "Test / Fehlbuchung", restoreInventory: true, sortOrder: 3 },
];

function mapReason(row: Record<string, unknown>): PosVoidReason {
  return {
    id: row.id as string,
    name: String(row.name ?? ""),
    restoreInventory: Boolean(row.restore_inventory),
    sortOrder: Number(row.sort_order ?? 0),
    isActive: Boolean(row.is_active),
  };
}

export async function listPosVoidReasons(
  supabase: SupabaseClient,
  restaurantId: string,
): Promise<PosVoidReason[]> {
  const { data, error } = await supabase
    .from("pos_void_reasons")
    .select("id, name, restore_inventory, sort_order, is_active")
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true });

  if (error) {
    console.warn("[pos] void reasons", error.message);
    return [];
  }
  return (data ?? []).map((r) => mapReason(r as Record<string, unknown>));
}

export async function ensureDefaultPosVoidReasons(
  supabase: SupabaseClient,
  restaurantId: string,
): Promise<PosVoidReason[]> {
  const existing = await listPosVoidReasons(supabase, restaurantId);
  if (existing.length > 0) return existing;

  const { error } = await supabase.from("pos_void_reasons").insert(
    DEFAULT_REASONS.map((r) => ({
      restaurant_id: restaurantId,
      name: r.name,
      restore_inventory: r.restoreInventory,
      sort_order: r.sortOrder,
      is_active: true,
    })),
  );
  if (error) {
    console.warn("[pos] seed void reasons", error.message);
  }
  return listPosVoidReasons(supabase, restaurantId);
}

export async function upsertPosVoidReason(params: {
  supabase: SupabaseClient;
  restaurantId: string;
  id?: string;
  name: string;
  restoreInventory?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}): Promise<PosVoidReason | null> {
  const name = params.name.trim();
  if (!name) return null;

  const payload = {
    restaurant_id: params.restaurantId,
    name,
    restore_inventory: params.restoreInventory ?? true,
    is_active: params.isActive ?? true,
  };

  if (params.id) {
    const updatePayload =
      params.sortOrder != null
        ? { ...payload, sort_order: params.sortOrder }
        : payload;
    const { data, error } = await params.supabase
      .from("pos_void_reasons")
      .update(updatePayload)
      .eq("id", params.id)
      .eq("restaurant_id", params.restaurantId)
      .select("id, name, restore_inventory, sort_order, is_active")
      .maybeSingle();
    if (error || !data) {
      console.warn("[pos] update void reason", error?.message);
      return null;
    }
    return mapReason(data as Record<string, unknown>);
  }

  let sortOrder = params.sortOrder;
  if (sortOrder == null) {
    const { data: last } = await params.supabase
      .from("pos_void_reasons")
      .select("sort_order")
      .eq("restaurant_id", params.restaurantId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    sortOrder = Number(last?.sort_order ?? -1) + 1;
  }

  const { data, error } = await params.supabase
    .from("pos_void_reasons")
    .insert({ ...payload, sort_order: sortOrder })
    .select("id, name, restore_inventory, sort_order, is_active")
    .single();

  if (error || !data) {
    console.warn("[pos] insert void reason", error?.message);
    return null;
  }
  return mapReason(data as Record<string, unknown>);
}

export async function deletePosVoidReason(
  supabase: SupabaseClient,
  restaurantId: string,
  id: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("pos_void_reasons")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", restaurantId);
  return !error;
}

export async function reorderPosVoidReasons(params: {
  supabase: SupabaseClient;
  restaurantId: string;
  orderedIds: string[];
}): Promise<boolean> {
  const results = await Promise.all(
    params.orderedIds.map((id, index) =>
      params.supabase
        .from("pos_void_reasons")
        .update({ sort_order: index })
        .eq("id", id)
        .eq("restaurant_id", params.restaurantId),
    ),
  );
  return results.every((r) => !r.error);
}

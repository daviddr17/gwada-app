import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export type DiningAreaRow = {
  id: string;
  restaurant_id: string;
  name: string;
  sort_order: number;
  /** Anzeige-/Sortiernummer, eindeutig pro Restaurant. */
  display_number: number;
  /** Chip-Farbe #rrggbb */
  color_hex: string;
};

export type DiningTableRow = {
  id: string;
  restaurant_id: string;
  area_id: string;
  table_number: number;
  table_name: string | null;
  capacity: number;
  sort_order: number;
  is_active: boolean;
  plan_x_pct: number;
  plan_y_pct: number;
  /** Breite des Tisch-Kastens auf dem Plan (Anteil der Canvas-Breite, ca. 4–70). */
  plan_w_pct: number;
  /** Höhe des Tisch-Kastens auf dem Plan (Anteil der Canvas-Höhe, ca. 4–70). */
  plan_h_pct: number;
  /** Anzeigefarbe auf dem Tischplan (#rrggbb). */
  color_hex: string;
  floor: string | null;
  /** ISO-Zeitstempel; für „zuletzt angelegt“ u. ä. */
  created_at?: string;
};

export function formatDiningTableLabel(t: Pick<DiningTableRow, "table_name" | "table_number">): string {
  const n = t.table_name?.trim();
  return n && n.length > 0 ? n : String(t.table_number);
}

/** Tisch mit dem neuesten `created_at` (Fallback: höchste Tischnummer). */
export function pickMostRecentlyCreatedDiningTable(
  tables: DiningTableRow[],
): DiningTableRow | null {
  if (tables.length === 0) return null;
  return [...tables].sort((a, b) => {
    const ca = a.created_at ?? "";
    const cb = b.created_at ?? "";
    if (ca !== cb) return cb.localeCompare(ca);
    return b.table_number - a.table_number;
  })[0] ?? null;
}

export async function fetchDiningAreas(
  restaurantId: string,
): Promise<{ data: DiningAreaRow[]; error: Error | null }> {
  if (!isUuidRestaurantId(restaurantId)) return { data: [], error: null };
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("dining_areas")
    .select("id, restaurant_id, name, sort_order, display_number, color_hex")
    .eq("restaurant_id", restaurantId)
    .order("display_number", { ascending: true })
    .order("name", { ascending: true });
  if (error) return { data: [], error: new Error(error.message) };
  return { data: (data ?? []) as DiningAreaRow[], error: null };
}

export async function fetchDiningTables(
  restaurantId: string,
): Promise<{ data: DiningTableRow[]; error: Error | null }> {
  if (!isUuidRestaurantId(restaurantId)) return { data: [], error: null };
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("dining_tables")
    .select(
      "id, restaurant_id, area_id, table_number, table_name, capacity, sort_order, is_active, plan_x_pct, plan_y_pct, plan_w_pct, plan_h_pct, color_hex, floor, created_at",
    )
    .eq("restaurant_id", restaurantId)
    .order("area_id", { ascending: true })
    .order("table_number", { ascending: true });
  if (error) return { data: [], error: new Error(error.message) };
  return { data: (data ?? []) as DiningTableRow[], error: null };
}

export async function insertDiningArea(params: {
  restaurantId: string;
  name: string;
  displayNumber: number;
  colorHex: string;
  sortOrder?: number;
}): Promise<{ data: DiningAreaRow | null; error: Error | null }> {
  const sb = createSupabaseBrowserClient();
  const hex =
    /^#[0-9A-Fa-f]{6}$/.test(params.colorHex) ? params.colorHex : "#64748b";
  const { data, error } = await sb
    .from("dining_areas")
    .insert({
      restaurant_id: params.restaurantId,
      name: params.name.trim(),
      sort_order: params.sortOrder ?? params.displayNumber,
      display_number: params.displayNumber,
      color_hex: hex,
    })
    .select("id, restaurant_id, name, sort_order, display_number, color_hex")
    .single();
  if (error) return { data: null, error: new Error(error.message) };
  return { data: data as DiningAreaRow, error: null };
}

export async function updateDiningArea(
  id: string,
  patch: {
    name?: string;
    sort_order?: number;
    display_number?: number;
    color_hex?: string;
  },
): Promise<{ error: Error | null }> {
  const sb = createSupabaseBrowserClient();
  const payload = { ...patch };
  if (payload.color_hex !== undefined) {
    payload.color_hex = /^#[0-9A-Fa-f]{6}$/.test(patch.color_hex ?? "")
      ? patch.color_hex
      : "#64748b";
  }
  const { error } = await sb.from("dining_areas").update(payload).eq("id", id);
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function deleteDiningArea(id: string): Promise<{ error: Error | null }> {
  const sb = createSupabaseBrowserClient();
  const { error } = await sb.from("dining_areas").delete().eq("id", id);
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function insertDiningTable(params: {
  restaurantId: string;
  areaId: string;
  tableNumber: number;
  tableName: string | null;
  capacity?: number;
  planXPct?: number;
  planYPct?: number;
  planWPct?: number;
  planHPct?: number;
  colorHex?: string;
}): Promise<{ data: DiningTableRow | null; error: Error | null }> {
  const sb = createSupabaseBrowserClient();
  const hex =
    /^#[0-9A-Fa-f]{6}$/.test(params.colorHex ?? "") ? params.colorHex! : "#94a3b8";
  const { data, error } = await sb
    .from("dining_tables")
    .insert({
      restaurant_id: params.restaurantId,
      area_id: params.areaId,
      table_number: params.tableNumber,
      table_name: params.tableName?.trim() || null,
      capacity: params.capacity ?? 4,
      sort_order: 0,
      is_active: true,
      plan_x_pct: params.planXPct ?? 15,
      plan_y_pct: params.planYPct ?? 15,
      plan_w_pct: params.planWPct ?? 13,
      plan_h_pct: params.planHPct ?? 20,
      color_hex: hex,
    })
    .select(
      "id, restaurant_id, area_id, table_number, table_name, capacity, sort_order, is_active, plan_x_pct, plan_y_pct, plan_w_pct, plan_h_pct, color_hex, floor, created_at",
    )
    .single();
  if (error) return { data: null, error: new Error(error.message) };
  return { data: data as DiningTableRow, error: null };
}

export async function updateDiningTable(
  id: string,
  patch: Partial<
    Pick<
      DiningTableRow,
      | "area_id"
      | "table_number"
      | "table_name"
      | "capacity"
      | "is_active"
      | "plan_x_pct"
      | "plan_y_pct"
      | "plan_w_pct"
      | "plan_h_pct"
      | "color_hex"
      | "sort_order"
    >
  >,
): Promise<{ error: Error | null }> {
  const sb = createSupabaseBrowserClient();
  const payload = { ...patch } as Record<string, unknown>;
  if (payload.color_hex !== undefined && typeof payload.color_hex === "string") {
    payload.color_hex = /^#[0-9A-Fa-f]{6}$/.test(payload.color_hex)
      ? payload.color_hex
      : "#94a3b8";
  }
  const { error } = await sb.from("dining_tables").update(payload).eq("id", id);
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function deleteDiningTable(id: string): Promise<{ error: Error | null }> {
  const sb = createSupabaseBrowserClient();
  const { error } = await sb.from("dining_tables").delete().eq("id", id);
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

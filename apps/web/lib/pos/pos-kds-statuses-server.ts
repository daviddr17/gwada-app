import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type PosKdsStatus = {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  printOnEnter: boolean;
  printerIds: string[];
  isActive: boolean;
};

const DEFAULT_STATUSES: Array<{
  name: string;
  color: string;
  sortOrder: number;
  printOnEnter: boolean;
}> = [
  { name: "Neu", color: "#3b82f6", sortOrder: 0, printOnEnter: false },
  {
    name: "In Zubereitung",
    color: "#f97316",
    sortOrder: 1,
    printOnEnter: false,
  },
  { name: "Fertig", color: "#22c55e", sortOrder: 2, printOnEnter: false },
];

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

export function normalizeKdsStatusColor(value: string): string | null {
  const trimmed = value.trim();
  if (!HEX_RE.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

function mapStatus(row: Record<string, unknown>): PosKdsStatus {
  return {
    id: row.id as string,
    name: String(row.name ?? ""),
    color: String(row.color ?? "#3b82f6"),
    sortOrder: Number(row.sort_order ?? 0),
    printOnEnter: Boolean(row.print_on_enter),
    printerIds: (row.printer_ids as string[] | null) ?? [],
    isActive: Boolean(row.is_active),
  };
}

export async function listPosKdsStatuses(
  supabase: SupabaseClient,
  restaurantId: string,
): Promise<PosKdsStatus[]> {
  const { data, error } = await supabase
    .from("pos_kds_statuses")
    .select(
      "id, name, color, sort_order, print_on_enter, printer_ids, is_active",
    )
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true });

  if (error) {
    console.warn("[pos] kds statuses", error.message);
    return [];
  }
  return (data ?? []).map((r) => mapStatus(r as Record<string, unknown>));
}

/** Seed Neu → In Zubereitung → Fertig when the restaurant has none yet. */
export async function ensureDefaultPosKdsStatuses(
  supabase: SupabaseClient,
  restaurantId: string,
): Promise<PosKdsStatus[]> {
  const existing = await listPosKdsStatuses(supabase, restaurantId);
  if (existing.length > 0) return existing;

  const rows = DEFAULT_STATUSES.map((s) => ({
    restaurant_id: restaurantId,
    name: s.name,
    color: s.color,
    sort_order: s.sortOrder,
    print_on_enter: s.printOnEnter,
    printer_ids: [] as string[],
    is_active: true,
  }));

  const { error } = await supabase.from("pos_kds_statuses").insert(rows);
  if (error) {
    console.warn("[pos] seed kds statuses", error.message);
    return listPosKdsStatuses(supabase, restaurantId);
  }
  return listPosKdsStatuses(supabase, restaurantId);
}

export async function upsertPosKdsStatus(params: {
  supabase: SupabaseClient;
  restaurantId: string;
  id?: string;
  name: string;
  color: string;
  printOnEnter?: boolean;
  printerIds?: string[];
  isActive?: boolean;
  sortOrder?: number;
}): Promise<PosKdsStatus | null> {
  const color = normalizeKdsStatusColor(params.color);
  if (!color) return null;
  const name = params.name.trim();
  if (!name) return null;

  const payload = {
    restaurant_id: params.restaurantId,
    name,
    color,
    print_on_enter: params.printOnEnter ?? false,
    printer_ids: params.printerIds ?? [],
    is_active: params.isActive ?? true,
  };

  if (params.id) {
    const updatePayload =
      params.sortOrder != null
        ? { ...payload, sort_order: params.sortOrder }
        : payload;
    const { data, error } = await params.supabase
      .from("pos_kds_statuses")
      .update(updatePayload)
      .eq("id", params.id)
      .eq("restaurant_id", params.restaurantId)
      .select(
        "id, name, color, sort_order, print_on_enter, printer_ids, is_active",
      )
      .maybeSingle();
    if (error || !data) {
      console.warn("[pos] update kds status", error?.message);
      return null;
    }
    return mapStatus(data as Record<string, unknown>);
  }

  let sortOrder = params.sortOrder;
  if (sortOrder == null) {
    const { data: last } = await params.supabase
      .from("pos_kds_statuses")
      .select("sort_order")
      .eq("restaurant_id", params.restaurantId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    sortOrder = Number(last?.sort_order ?? -1) + 1;
  }

  const { data, error } = await params.supabase
    .from("pos_kds_statuses")
    .insert({ ...payload, sort_order: sortOrder })
    .select(
      "id, name, color, sort_order, print_on_enter, printer_ids, is_active",
    )
    .single();

  if (error || !data) {
    console.warn("[pos] insert kds status", error?.message);
    return null;
  }
  return mapStatus(data as Record<string, unknown>);
}

export async function deletePosKdsStatus(
  supabase: SupabaseClient,
  restaurantId: string,
  id: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("pos_kds_statuses")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", restaurantId);
  return !error;
}

export async function reorderPosKdsStatuses(params: {
  supabase: SupabaseClient;
  restaurantId: string;
  orderedIds: string[];
}): Promise<boolean> {
  const updates = params.orderedIds.map((id, index) =>
    params.supabase
      .from("pos_kds_statuses")
      .update({ sort_order: index })
      .eq("id", id)
      .eq("restaurant_id", params.restaurantId),
  );
  const results = await Promise.all(updates);
  return results.every((r) => !r.error);
}

export async function firstActiveKdsStatusId(
  supabase: SupabaseClient,
  restaurantId: string,
): Promise<string | null> {
  const statuses = await ensureDefaultPosKdsStatuses(supabase, restaurantId);
  const first = statuses.find((s) => s.isActive) ?? statuses[0] ?? null;
  return first?.id ?? null;
}

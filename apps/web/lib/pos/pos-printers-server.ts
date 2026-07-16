import "server-only";

import type {
  PosPrinterConnectionType,
} from "@gwada/pos-domain";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PosPrinter = {
  id: string;
  name: string;
  connectionType: PosPrinterConnectionType;
  connectionConfig: Record<string, unknown>;
  settings: Record<string, unknown>;
  sortOrder: number;
  isActive: boolean;
};

function mapPrinter(row: Record<string, unknown>): PosPrinter {
  return {
    id: row.id as string,
    name: String(row.name ?? ""),
    connectionType: (row.connection_type as PosPrinterConnectionType) ?? "virtual",
    connectionConfig:
      (row.connection_config as Record<string, unknown> | null) ?? {},
    settings: (row.settings as Record<string, unknown> | null) ?? {},
    sortOrder: Number(row.sort_order ?? 0),
    isActive: Boolean(row.is_active),
  };
}

export async function listPosPrinters(
  supabase: SupabaseClient,
  restaurantId: string,
): Promise<PosPrinter[]> {
  const { data, error } = await supabase
    .from("pos_printers")
    .select(
      "id, name, connection_type, connection_config, settings, sort_order, is_active",
    )
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true });

  if (error) {
    console.warn("[pos] printers", error.message);
    return [];
  }
  return (data ?? []).map((r) => mapPrinter(r as Record<string, unknown>));
}

export async function upsertPosPrinter(params: {
  supabase: SupabaseClient;
  restaurantId: string;
  id?: string;
  name: string;
  connectionType: PosPrinterConnectionType;
  connectionConfig?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  isActive?: boolean;
}): Promise<PosPrinter | null> {
  const payload = {
    restaurant_id: params.restaurantId,
    name: params.name.trim(),
    connection_type: params.connectionType,
    connection_config: params.connectionConfig ?? {},
    settings: params.settings ?? {},
    is_active: params.isActive ?? true,
  };

  if (params.id) {
    const { data, error } = await params.supabase
      .from("pos_printers")
      .update(payload)
      .eq("id", params.id)
      .eq("restaurant_id", params.restaurantId)
      .select(
        "id, name, connection_type, connection_config, settings, sort_order, is_active",
      )
      .maybeSingle();
    if (error) {
      console.warn("[pos] update printer", error.message);
      return null;
    }
    return data ? mapPrinter(data as Record<string, unknown>) : null;
  }

  const { data, error } = await params.supabase
    .from("pos_printers")
    .insert(payload)
    .select(
      "id, name, connection_type, connection_config, settings, sort_order, is_active",
    )
    .maybeSingle();
  if (error) {
    console.warn("[pos] insert printer", error.message);
    return null;
  }
  return data ? mapPrinter(data as Record<string, unknown>) : null;
}

export async function deletePosPrinter(
  supabase: SupabaseClient,
  restaurantId: string,
  id: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("pos_printers")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", restaurantId);
  if (error) {
    console.warn("[pos] delete printer", error.message);
    return false;
  }
  return true;
}

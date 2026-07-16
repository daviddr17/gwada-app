import "server-only";

import type { PosOrderCourse } from "@gwada/pos-domain";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadActivePosOrders, type PosOrderDto } from "@/lib/pos/pos-responses";

export type PosKdsDevice = {
  id: string;
  name: string;
  menuCategoryIds: string[];
  courses: PosOrderCourse[];
  settings: Record<string, unknown>;
  sortOrder: number;
  isActive: boolean;
};

export type PosKdsTicket = {
  orderId: string;
  orderNumber: number;
  status: string;
  tableSessionId: string;
  createdAt: string;
  lines: Array<{
    id: string;
    name: string;
    quantity: number;
    course: string;
    notes: string | null;
    modifiers: unknown[];
    ohneIngredientIds: string[];
    menuItemId: string | null;
  }>;
};

function mapDevice(row: Record<string, unknown>): PosKdsDevice {
  return {
    id: row.id as string,
    name: String(row.name ?? ""),
    menuCategoryIds: (row.menu_category_ids as string[] | null) ?? [],
    courses: ((row.courses as string[] | null) ?? []) as PosOrderCourse[],
    settings: (row.settings as Record<string, unknown> | null) ?? {},
    sortOrder: Number(row.sort_order ?? 0),
    isActive: Boolean(row.is_active),
  };
}

export async function listPosKdsDevices(
  supabase: SupabaseClient,
  restaurantId: string,
): Promise<PosKdsDevice[]> {
  const { data, error } = await supabase
    .from("pos_kds_devices")
    .select(
      "id, name, menu_category_ids, courses, settings, sort_order, is_active",
    )
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true });

  if (error) {
    console.warn("[pos] kds devices", error.message);
    return [];
  }
  return (data ?? []).map((r) => mapDevice(r as Record<string, unknown>));
}

export async function upsertPosKdsDevice(params: {
  supabase: SupabaseClient;
  restaurantId: string;
  id?: string;
  name: string;
  menuCategoryIds: string[];
  courses: PosOrderCourse[];
  settings?: Record<string, unknown>;
  isActive?: boolean;
}): Promise<PosKdsDevice | null> {
  const payload = {
    restaurant_id: params.restaurantId,
    name: params.name.trim(),
    menu_category_ids: params.menuCategoryIds,
    courses: params.courses,
    settings: params.settings ?? {},
    is_active: params.isActive ?? true,
  };

  if (params.id) {
    const { data, error } = await params.supabase
      .from("pos_kds_devices")
      .update(payload)
      .eq("id", params.id)
      .eq("restaurant_id", params.restaurantId)
      .select(
        "id, name, menu_category_ids, courses, settings, sort_order, is_active",
      )
      .maybeSingle();
    if (error || !data) {
      console.warn("[pos] update kds", error?.message);
      return null;
    }
    return mapDevice(data as Record<string, unknown>);
  }

  const { data: last } = await params.supabase
    .from("pos_kds_devices")
    .select("sort_order")
    .eq("restaurant_id", params.restaurantId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await params.supabase
    .from("pos_kds_devices")
    .insert({
      ...payload,
      sort_order: Number(last?.sort_order ?? -1) + 1,
    })
    .select(
      "id, name, menu_category_ids, courses, settings, sort_order, is_active",
    )
    .single();

  if (error || !data) {
    console.warn("[pos] insert kds", error?.message);
    return null;
  }
  return mapDevice(data as Record<string, unknown>);
}

export async function deletePosKdsDevice(
  supabase: SupabaseClient,
  restaurantId: string,
  id: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("pos_kds_devices")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", restaurantId);
  return !error;
}

/** Filtert aktive Orders für ein KDS (Kategorien/Gänge). */
export function filterOrdersForKds(
  orders: PosOrderDto[],
  device: PosKdsDevice,
  categoryByMenuItemId: Map<string, string>,
): PosKdsTicket[] {
  const catFilter = new Set(device.menuCategoryIds);
  const courseFilter = new Set(device.courses);
  const kitchenStatuses = new Set(["received", "preparing", "ready"]);

  const tickets: PosKdsTicket[] = [];
  for (const order of orders) {
    if (!kitchenStatuses.has(order.status)) continue;
    const lines = order.lines.filter((line) => {
      if (courseFilter.size > 0 && !courseFilter.has(line.course as PosOrderCourse)) {
        return false;
      }
      if (catFilter.size > 0) {
        const cat = line.menuItemId
          ? categoryByMenuItemId.get(line.menuItemId)
          : undefined;
        if (!cat || !catFilter.has(cat)) return false;
      }
      return true;
    });
    if (!lines.length) continue;
    tickets.push({
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      tableSessionId: order.tableSessionId,
      createdAt: order.createdAt,
      lines: lines.map((l) => ({
        id: l.id,
        name: l.name,
        quantity: l.quantity,
        course: l.course,
        notes: l.notes,
        modifiers: l.modifiers,
        ohneIngredientIds: l.ohneIngredientIds,
        menuItemId: l.menuItemId,
      })),
    });
  }
  return tickets.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function loadKdsTickets(params: {
  supabase: SupabaseClient;
  restaurantId: string;
  deviceId?: string | null;
}): Promise<{ devices: PosKdsDevice[]; tickets: PosKdsTicket[] }> {
  const [devices, orders] = await Promise.all([
    listPosKdsDevices(params.supabase, params.restaurantId),
    loadActivePosOrders(params.supabase, params.restaurantId),
  ]);

  const { data: menuItems } = await params.supabase
    .from("menu_items")
    .select("id, category_id")
    .eq("restaurant_id", params.restaurantId);
  const categoryByMenuItemId = new Map(
    (menuItems ?? []).map((m) => [m.id as string, m.category_id as string]),
  );

  const device =
    (params.deviceId
      ? devices.find((d) => d.id === params.deviceId && d.isActive)
      : devices.find((d) => d.isActive)) ?? null;

  const tickets = device
    ? filterOrdersForKds(orders, device, categoryByMenuItemId)
    : filterOrdersForKds(
        orders,
        {
          id: "all",
          name: "Alle",
          menuCategoryIds: [],
          courses: [],
          settings: {},
          sortOrder: 0,
          isActive: true,
        },
        categoryByMenuItemId,
      );

  return { devices, tickets };
}

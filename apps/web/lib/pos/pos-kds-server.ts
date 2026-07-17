import "server-only";

import type { PosOrderCourse } from "@gwada/pos-domain";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  categoryAllowsKds,
  listPosCategoryRoutes,
  type PosCategoryRoute,
} from "@/lib/pos/pos-category-routes-server";
import {
  ensureDefaultPosKdsStatuses,
  listPosKdsStatuses,
  type PosKdsStatus,
} from "@/lib/pos/pos-kds-statuses-server";
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

export type PosKdsTicketLine = {
  id: string;
  name: string;
  quantity: number;
  course: string;
  notes: string | null;
  modifiers: unknown[];
  ohneIngredientIds: string[];
  menuItemId: string | null;
};

export type PosKdsTicket = {
  orderId: string;
  orderNumber: number;
  /** @deprecated Prefer statusName — kept for older clients */
  status: string;
  statusId: string;
  statusName: string;
  statusColor: string;
  statusSortOrder: number;
  printOnEnter: boolean;
  tableSessionId: string;
  createdAt: string;
  lines: PosKdsTicketLine[];
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

function mapTicketLines(order: PosOrderDto): PosKdsTicketLine[] {
  return order.lines.map((l) => ({
    id: l.id,
    name: l.name,
    quantity: l.quantity,
    course: l.course,
    notes: l.notes,
    modifiers: l.modifiers,
    ohneIngredientIds: l.ohneIngredientIds,
    menuItemId: l.menuItemId,
  }));
}

/** Filtert aktive Orders für ein KDS (Kategorien/Gänge + konfigurierter Status). */
export function filterOrdersForKds(
  orders: PosOrderDto[],
  device: PosKdsDevice,
  categoryByMenuItemId: Map<string, string>,
  categoryRoutes: PosCategoryRoute[] = [],
  statusByOrderId: Map<string, PosKdsStatus>,
): PosKdsTicket[] {
  const catFilter = new Set(device.menuCategoryIds);
  const courseFilter = new Set(device.courses);
  const tickets: PosKdsTicket[] = [];
  for (const order of orders) {
    const kdsStatus = statusByOrderId.get(order.id);
    if (!kdsStatus || !kdsStatus.isActive) continue;

    const lines = order.lines.filter((line) => {
      if (
        courseFilter.size > 0 &&
        !courseFilter.has(line.course as PosOrderCourse)
      ) {
        return false;
      }
      const cat = line.menuItemId
        ? categoryByMenuItemId.get(line.menuItemId)
        : undefined;
      if (!categoryAllowsKds(categoryRoutes, cat)) return false;
      const route = categoryRoutes.find((r) => r.menuCategoryId === cat);
      if (
        device.id !== "all" &&
        route &&
        route.kdsDeviceIds.length > 0 &&
        !route.kdsDeviceIds.includes(device.id)
      ) {
        return false;
      }
      if (catFilter.size > 0) {
        if (!cat || !catFilter.has(cat)) return false;
      }
      return true;
    });
    if (!lines.length) continue;
    tickets.push({
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: kdsStatus.name,
      statusId: kdsStatus.id,
      statusName: kdsStatus.name,
      statusColor: kdsStatus.color,
      statusSortOrder: kdsStatus.sortOrder,
      printOnEnter: kdsStatus.printOnEnter,
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
}): Promise<{
  devices: PosKdsDevice[];
  statuses: PosKdsStatus[];
  tickets: PosKdsTicket[];
}> {
  const [devices, orders, categoryRoutes, statuses] = await Promise.all([
    listPosKdsDevices(params.supabase, params.restaurantId),
    loadActivePosOrders(params.supabase, params.restaurantId),
    listPosCategoryRoutes(params.supabase, params.restaurantId),
    ensureDefaultPosKdsStatuses(params.supabase, params.restaurantId),
  ]);

  const orderIds = orders.map((o) => o.id);
  const statusByOrderId = new Map<string, PosKdsStatus>();
  if (orderIds.length > 0) {
    const { data: statusRows } = await params.supabase
      .from("pos_orders")
      .select("id, kds_status_id")
      .in("id", orderIds);
    const byId = new Map(statuses.map((s) => [s.id, s]));
    for (const row of statusRows ?? []) {
      const statusId = row.kds_status_id as string | null;
      if (!statusId) continue;
      const status = byId.get(statusId);
      if (status) statusByOrderId.set(row.id as string, status);
    }
  }

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
    ? filterOrdersForKds(
        orders,
        device,
        categoryByMenuItemId,
        categoryRoutes,
        statusByOrderId,
      )
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
        categoryRoutes,
        statusByOrderId,
      );

  return { devices, statuses, tickets };
}

export type AdvanceKdsTicketResult =
  | {
      ok: true;
      done: boolean;
      ticket: PosKdsTicket | null;
      printRequested: boolean;
      printerIds: string[];
      orderNumber: number;
      lines: PosKdsTicketLine[];
    }
  | { ok: false; error: string; status: number };

/** Tap: nächsten KDS-Status; nach dem letzten Status Ticket vom Board nehmen. */
export async function advanceKdsTicketStatus(params: {
  supabase: SupabaseClient;
  restaurantId: string;
  orderId: string;
  deviceId?: string | null;
  userId?: string | null;
}): Promise<AdvanceKdsTicketResult> {
  const statuses = (
    await ensureDefaultPosKdsStatuses(params.supabase, params.restaurantId)
  ).filter((s) => s.isActive);

  if (statuses.length === 0) {
    return { ok: false, error: "no_kds_statuses", status: 400 };
  }

  const { data: order, error } = await params.supabase
    .from("pos_orders")
    .select("id, order_number, table_session_id, created_at, kds_status_id, status")
    .eq("id", params.orderId)
    .eq("restaurant_id", params.restaurantId)
    .maybeSingle();

  if (error || !order) {
    return { ok: false, error: "order_not_found", status: 404 };
  }

  const currentId = order.kds_status_id as string | null;
  const currentIndex = currentId
    ? statuses.findIndex((s) => s.id === currentId)
    : -1;
  const next = currentIndex < 0 ? statuses[0]! : statuses[currentIndex + 1];

  if (!next) {
    await params.supabase
      .from("pos_orders")
      .update({ kds_status_id: null })
      .eq("id", params.orderId)
      .eq("restaurant_id", params.restaurantId);

    const { tickets } = await loadKdsTickets({
      supabase: params.supabase,
      restaurantId: params.restaurantId,
      deviceId: params.deviceId,
    });
    const previousTicket = tickets.find((t) => t.orderId === params.orderId);
    return {
      ok: true,
      done: true,
      ticket: null,
      printRequested: false,
      printerIds: [],
      orderNumber: Number(order.order_number ?? 0),
      lines: previousTicket?.lines ?? [],
    };
  }

  const { error: updateError } = await params.supabase
    .from("pos_orders")
    .update({ kds_status_id: next.id })
    .eq("id", params.orderId)
    .eq("restaurant_id", params.restaurantId);

  if (updateError) {
    console.warn("[pos] advance kds", updateError.message);
    return { ok: false, error: "advance_failed", status: 500 };
  }

  if (params.userId) {
    const { schedulePosInventoryDeduct } = await import(
      "@/lib/pos/pos-inventory-booking-server"
    );
    schedulePosInventoryDeduct({
      restaurantId: params.restaurantId,
      orderId: params.orderId,
      kdsStatusId: next.id,
      userId: params.userId,
    });
  }

  const loaded = await loadKdsTickets({
    supabase: params.supabase,
    restaurantId: params.restaurantId,
    deviceId: params.deviceId,
  });
  const ticket =
    loaded.tickets.find((t) => t.orderId === params.orderId) ?? null;

  // If device filter hid the ticket, still build lines from order for print.
  let lines = ticket?.lines ?? [];
  if (!lines.length) {
    const { loadPosOrderDto } = await import("@/lib/pos/pos-responses");
    const dto = await loadPosOrderDto(params.supabase, params.orderId);
    if (dto) lines = mapTicketLines(dto);
  }

  return {
    ok: true,
    done: false,
    ticket: ticket
      ? ticket
      : {
          orderId: params.orderId,
          orderNumber: Number(order.order_number ?? 0),
          status: next.name,
          statusId: next.id,
          statusName: next.name,
          statusColor: next.color,
          statusSortOrder: next.sortOrder,
          printOnEnter: next.printOnEnter,
          tableSessionId: String(order.table_session_id ?? ""),
          createdAt: String(order.created_at ?? new Date().toISOString()),
          lines,
        },
    printRequested: next.printOnEnter,
    printerIds: next.printerIds,
    orderNumber: Number(order.order_number ?? 0),
    lines,
  };
}

export type { PosKdsStatus };

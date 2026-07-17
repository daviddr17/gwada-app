import "server-only";

import {
  assertPosOrderStatusTransition,
  isPosOrderCourse,
  type PosOrderCourse,
  type PosOrderStatus,
} from "@gwada/pos-domain";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isMenuItemPubliclyAvailable } from "@/lib/menu/item-utils";
import { getOpenRegisterSession } from "@/lib/pos/register-report-aggregate";
import { fetchRestaurantTimezoneServer } from "@/lib/supabase/restaurant-timezone-server";

export type PosOrderLineModifier = {
  type: "ohne" | "option" | "text";
  label: string;
  ingredientId?: string;
  optionChoiceId?: string;
  priceDeltaCents?: number;
};

export type CreatePosOrderLineInput = {
  menuItemId: string;
  quantity: number;
  notes?: string;
  course?: PosOrderCourse | string;
  ohneIngredientIds?: string[];
  modifiers?: PosOrderLineModifier[];
};

export async function openPosTableSession(params: {
  supabase: SupabaseClient;
  restaurantId: string;
  diningTableId: string;
  coverCount?: number;
  openedByProfileId: string;
  reservationId?: string | null;
}): Promise<
  | { ok: true; sessionId: string }
  | { ok: false; error: string; status: number }
> {
  const coverCount = params.coverCount ?? 1;
  if (coverCount < 1 || coverCount > 50) {
    return { ok: false, error: "invalid_cover_count", status: 400 };
  }

  const { data: table, error: tableError } = await params.supabase
    .from("dining_tables")
    .select("id, restaurant_id, is_active")
    .eq("id", params.diningTableId)
    .maybeSingle();

  if (tableError || !table) {
    return { ok: false, error: "table_not_found", status: 404 };
  }

  if (table.restaurant_id !== params.restaurantId) {
    return { ok: false, error: "table_restaurant_mismatch", status: 400 };
  }

  if (!table.is_active) {
    return { ok: false, error: "table_inactive", status: 400 };
  }

  const { data: existingOpen } = await params.supabase
    .from("pos_table_sessions")
    .select("id")
    .eq("dining_table_id", params.diningTableId)
    .eq("status", "open")
    .maybeSingle();

  if (existingOpen) {
    return { ok: true, sessionId: existingOpen.id as string };
  }

  const registerSession = await getOpenRegisterSession(params.restaurantId);
  if (!registerSession) {
    return { ok: false, error: "register_closed", status: 403 };
  }

  const { data, error } = await params.supabase
    .from("pos_table_sessions")
    .insert({
      restaurant_id: params.restaurantId,
      dining_table_id: params.diningTableId,
      cover_count: coverCount,
      opened_by_profile_id: params.openedByProfileId,
      reservation_id: params.reservationId ?? null,
      status: "open",
    })
    .select("id")
    .single();

  if (error || !data) {
    console.warn("[pos] open session", error?.message);
    return { ok: false, error: "create_session_failed", status: 500 };
  }

  return { ok: true, sessionId: data.id as string };
}

export async function createPosOrder(params: {
  supabase: SupabaseClient;
  restaurantId: string;
  tableSessionId: string;
  createdByProfileId: string;
  items: CreatePosOrderLineInput[];
  notes?: string | null;
}): Promise<
  | { ok: true; orderId: string; orderNumber: number }
  | { ok: false; error: string; status: number }
> {
  if (!params.items.length) {
    return { ok: false, error: "empty_order", status: 400 };
  }

  const { data: session, error: sessionError } = await params.supabase
    .from("pos_table_sessions")
    .select("id, restaurant_id, status")
    .eq("id", params.tableSessionId)
    .maybeSingle();

  if (sessionError || !session) {
    return { ok: false, error: "session_not_found", status: 404 };
  }

  if (session.restaurant_id !== params.restaurantId) {
    return { ok: false, error: "session_restaurant_mismatch", status: 400 };
  }

  if (session.status !== "open") {
    return { ok: false, error: "session_closed", status: 400 };
  }

  const registerSession = await getOpenRegisterSession(params.restaurantId);
  if (!registerSession) {
    return { ok: false, error: "register_closed", status: 403 };
  }

  const menuItemIds = [...new Set(params.items.map((i) => i.menuItemId))];
  const { data: menuItems, error: menuError } = await params.supabase
    .from("menu_items")
    .select("id, name, price, vat_rate, is_active, restaurant_id, available_from, available_to")
    .in("id", menuItemIds)
    .eq("restaurant_id", params.restaurantId);

  if (menuError || !menuItems?.length) {
    return { ok: false, error: "menu_items_not_found", status: 400 };
  }

  const menuById = new Map(menuItems.map((m) => [m.id as string, m]));

  const admin = params.supabase;
  const restaurantTimeZone = await fetchRestaurantTimezoneServer(
    admin,
    params.restaurantId,
  );

  let subtotalCents = 0;
  const lineRows: Array<Record<string, unknown>> = [];

  for (let i = 0; i < params.items.length; i++) {
    const input = params.items[i]!;
    const menuItem = menuById.get(input.menuItemId);
    if (
      !menuItem ||
      !isMenuItemPubliclyAvailable({
        id: menuItem.id as string,
        name: menuItem.name as string,
        description: "",
        price: Number(menuItem.price),
        category: "",
        imageUrl: "",
        tags: [],
        active: Boolean(menuItem.is_active),
        availableFrom: (menuItem.available_from as string | null) ?? null,
        availableTo: (menuItem.available_to as string | null) ?? null,
      }, new Date(), restaurantTimeZone)
    ) {
      return { ok: false, error: "invalid_menu_item", status: 400 };
    }

    const qty = input.quantity;
    if (!Number.isFinite(qty) || qty <= 0) {
      return { ok: false, error: "invalid_quantity", status: 400 };
    }

    const modifiers = Array.isArray(input.modifiers) ? input.modifiers : [];
    const optionDelta = modifiers.reduce(
      (sum, m) => sum + (Number(m.priceDeltaCents) || 0),
      0,
    );
    const unitCents = Math.round(Number(menuItem.price) * 100) + optionDelta;
    const lineTotalCents = Math.round(unitCents * qty);
    subtotalCents += lineTotalCents;

    const course: PosOrderCourse =
      input.course && isPosOrderCourse(input.course) ? input.course : "other";
    const ohneIds = (input.ohneIngredientIds ?? []).filter(
      (id) => typeof id === "string" && id.trim().length > 0,
    );

    lineRows.push({
      menu_item_id: menuItem.id,
      name: menuItem.name,
      quantity: qty,
      unit_price_cents: unitCents,
      vat_rate: menuItem.vat_rate ?? 19,
      line_total_cents: lineTotalCents,
      notes: input.notes?.trim() || null,
      course,
      ohne_ingredient_ids: ohneIds,
      modifiers,
      position: i,
    });
  }

  const { firstActiveKdsStatusId } = await import(
    "@/lib/pos/pos-kds-statuses-server"
  );
  const kdsStatusId = await firstActiveKdsStatusId(
    params.supabase,
    params.restaurantId,
  );

  const { data: order, error: orderError } = await params.supabase
    .from("pos_orders")
    .insert({
      restaurant_id: params.restaurantId,
      table_session_id: params.tableSessionId,
      status: "received",
      kds_status_id: kdsStatusId,
      subtotal_cents: subtotalCents,
      total_cents: subtotalCents,
      notes: params.notes?.trim() || null,
      created_by_profile_id: params.createdByProfileId,
    })
    .select("id, order_number")
    .single();

  if (orderError || !order) {
    console.warn("[pos] create order", orderError?.message);
    return { ok: false, error: "create_order_failed", status: 500 };
  }

  const { error: linesError } = await params.supabase
    .from("pos_order_lines")
    .insert(lineRows.map((row) => ({ ...row, order_id: order.id })));

  if (linesError) {
    console.warn("[pos] create order lines", linesError.message);
    await params.supabase.from("pos_orders").delete().eq("id", order.id);
    return { ok: false, error: "create_order_lines_failed", status: 500 };
  }

  return {
    ok: true,
    orderId: order.id as string,
    orderNumber: order.order_number as number,
  };
}

export async function updatePosOrderStatus(params: {
  supabase: SupabaseClient;
  restaurantId: string;
  orderId: string;
  status: PosOrderStatus;
}): Promise<
  | { ok: true; status: PosOrderStatus }
  | { ok: false; error: string; status: number }
> {
  const { data: order, error } = await params.supabase
    .from("pos_orders")
    .select("id, status, restaurant_id")
    .eq("id", params.orderId)
    .maybeSingle();

  if (error || !order) {
    return { ok: false, error: "order_not_found", status: 404 };
  }

  if (order.restaurant_id !== params.restaurantId) {
    return { ok: false, error: "forbidden", status: 403 };
  }

  const from = order.status as PosOrderStatus;
  try {
    assertPosOrderStatusTransition(from, params.status);
  } catch {
    return { ok: false, error: "invalid_status_transition", status: 400 };
  }

  const { error: updateError } = await params.supabase
    .from("pos_orders")
    .update({ status: params.status })
    .eq("id", params.orderId);

  if (updateError) {
    return { ok: false, error: "update_failed", status: 500 };
  }

  return { ok: true, status: params.status };
}

export async function payPosOrderCash(params: {
  supabase: SupabaseClient;
  restaurantId: string;
  orderId: string;
  tipCents?: number;
  receivedAmountCents?: number | null;
}): Promise<
  | { ok: true; paymentId: string }
  | { ok: false; error: string; status: number }
> {
  const { data: order, error: orderError } = await params.supabase
    .from("pos_orders")
    .select("id, restaurant_id, total_cents, status")
    .eq("id", params.orderId)
    .maybeSingle();

  if (orderError || !order) {
    return { ok: false, error: "order_not_found", status: 404 };
  }

  if (order.restaurant_id !== params.restaurantId) {
    return { ok: false, error: "forbidden", status: 403 };
  }

  if (order.status === "cancelled" || order.status === "delivered") {
    return { ok: false, error: "order_closed", status: 400 };
  }

  const { data: existingPaid } = await params.supabase
    .from("pos_payments")
    .select("id")
    .eq("order_id", params.orderId)
    .eq("status", "paid")
    .maybeSingle();

  if (existingPaid) {
    return { ok: false, error: "already_paid", status: 400 };
  }

  const tipCents = Math.max(0, params.tipCents ?? 0);
  const baseCents = Number(order.total_cents);
  const finalTotalCents = baseCents + tipCents;

  if (tipCents > 0) {
    const { error: tipError } = await params.supabase
      .from("pos_orders")
      .update({
        tip_cents: tipCents,
        total_cents: finalTotalCents,
      })
      .eq("id", params.orderId);

    if (tipError) {
      return { ok: false, error: "update_tip_failed", status: 500 };
    }
  }

  const { data: payment, error: payError } = await params.supabase
    .from("pos_payments")
    .insert({
      order_id: params.orderId,
      restaurant_id: params.restaurantId,
      amount_cents: finalTotalCents,
      tip_cents: tipCents,
      received_amount_cents: params.receivedAmountCents ?? null,
      method: "cash",
      status: "paid",
      paid_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (payError || !payment) {
    console.warn("[pos] cash payment", payError?.message);
    return { ok: false, error: "payment_failed", status: 500 };
  }

  return { ok: true, paymentId: payment.id as string };
}

import "server-only";

import { randomBytes } from "node:crypto";
import type {
  PosFulfillmentType,
  PosOrderChannel,
} from "@gwada/pos-domain";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isMenuItemPubliclyAvailable } from "@/lib/menu/item-utils";
import type { GuestCheckoutInput } from "@/lib/ordering/online-ordering-types";
import {
  loadOnlineOrderingSettings,
  resolveDeliveryFeeCents,
} from "@/lib/ordering/online-ordering-settings-server";
import { createRestaurantGuestPayment } from "@/lib/payments/create-guest-payment";
import { getPublicSiteUrl } from "@/lib/public-env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchRestaurantTimezoneServer } from "@/lib/supabase/restaurant-timezone-server";
import { normalizeRestaurantSlugInput } from "@/lib/restaurant/restaurant-slug";

function newStatusToken(): string {
  return randomBytes(24).toString("base64url");
}

function siteBase(): string {
  return (getPublicSiteUrl() || "https://gwada.app").replace(/\/$/, "");
}

export async function resolveRestaurantBySlug(
  slug: string,
): Promise<
  | { ok: true; restaurantId: string; name: string; slug: string }
  | { ok: false; error: string; status: number }
> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "server_misconfigured", status: 503 };

  const normalized = normalizeRestaurantSlugInput(slug);
  if (!normalized) return { ok: false, error: "not_found", status: 404 };

  const { data, error } = await admin
    .from("restaurants")
    .select("id, name, slug")
    .eq("slug", normalized)
    .maybeSingle();

  if (error || !data?.id) {
    return { ok: false, error: "not_found", status: 404 };
  }

  return {
    ok: true,
    restaurantId: data.id as string,
    name: String(data.name ?? ""),
    slug: String(data.slug ?? normalized),
  };
}

export async function createGuestOrderCheckout(params: {
  slug: string;
  input: GuestCheckoutInput;
  /** Absolute or path redirect after Mollie; token placeholder `{token}`. */
  redirectPathTemplate?: string;
}): Promise<
  | {
      ok: true;
      orderId: string;
      orderNumber: number;
      statusToken: string;
      checkoutUrl: string | null;
      guestPaymentId: string | null;
      molliePaymentId: string | null;
      paymentMode: "hosted" | "terminal";
      totalCents: number;
    }
  | { ok: false; error: string; status: number }
> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "server_misconfigured", status: 503 };

  const restaurant = await resolveRestaurantBySlug(params.slug);
  if (!restaurant.ok) return restaurant;

  const channel = params.input.channel;
  if (channel !== "online" && channel !== "kiosk" && channel !== "table") {
    return { ok: false, error: "invalid_channel", status: 400 };
  }

  const settings = await loadOnlineOrderingSettings(
    admin,
    restaurant.restaurantId,
  );

  if (channel === "online" && !settings.onlineEnabled) {
    return { ok: false, error: "online_disabled", status: 403 };
  }
  if ((channel === "kiosk" || channel === "table") && !settings.kioskEnabled) {
    return { ok: false, error: "kiosk_disabled", status: 403 };
  }

  const fulfillment = params.input.fulfillmentType;
  if (fulfillment === "pickup" && !settings.pickupEnabled) {
    return { ok: false, error: "pickup_disabled", status: 400 };
  }
  if (fulfillment === "delivery" && !settings.deliveryEnabled) {
    return { ok: false, error: "delivery_disabled", status: 400 };
  }
  if (fulfillment === "dine_in" && channel === "online") {
    return { ok: false, error: "dine_in_online_unsupported", status: 400 };
  }

  const guestName = params.input.guestName?.trim() ?? "";
  if (channel === "online" && guestName.length < 2) {
    return { ok: false, error: "guest_name_required", status: 400 };
  }

  const items = params.input.items ?? [];
  if (!items.length) {
    return { ok: false, error: "empty_order", status: 400 };
  }

  let deliveryFeeCents = 0;
  let minOrder = settings.minOrderCentsPickup;
  if (fulfillment === "delivery") {
    const fee = resolveDeliveryFeeCents(
      settings,
      params.input.deliveryPostalCode,
    );
    if (!fee.ok) return { ok: false, error: fee.error, status: 400 };
    if (!params.input.deliveryAddress?.trim()) {
      return { ok: false, error: "delivery_address_required", status: 400 };
    }
    deliveryFeeCents = fee.feeCents;
    minOrder = fee.minOrderCents;
  }

  const priced = await priceGuestLines({
    supabase: admin,
    restaurantId: restaurant.restaurantId,
    items,
  });
  if (!priced.ok) return priced;

  if (priced.subtotalCents < minOrder) {
    return { ok: false, error: "below_min_order", status: 400 };
  }

  const totalCents = priced.subtotalCents + deliveryFeeCents;
  if (totalCents <= 0) {
    return { ok: false, error: "invalid_total", status: 400 };
  }

  const { resolveGuestOrderTiming } = await import(
    "@/lib/ordering/ordering-lead-time"
  );
  const timingMode =
    params.input.timingMode ??
    (params.input.slotStartAt ? "scheduled" : "asap");
  const timing = resolveGuestOrderTiming({
    channel,
    fulfillment,
    settings,
    timingMode,
    scheduledAt: params.input.scheduledAt ?? params.input.slotStartAt,
  });
  if (!timing.ok) {
    return { ok: false, error: timing.error, status: 400 };
  }
  const slotStartAt = timing.slotStartAt;
  const slotEndAt = timing.slotEndAt;
  const fulfillmentAsap = timing.fulfillmentAsap;

  const wantTerminal =
    channel === "kiosk" &&
    params.input.payWithTerminal !== false;
  const terminalId =
    params.input.mollieTerminalId?.trim() ||
    settings.kioskMollieTerminalId ||
    "";

  const statusToken = newStatusToken();
  const { firstActiveKdsStatusId } = await import(
    "@/lib/pos/pos-kds-statuses-server"
  );
  const kdsStatusId = await firstActiveKdsStatusId(
    admin,
    restaurant.restaurantId,
  );

  const { data: order, error: orderError } = await admin
    .from("pos_orders")
    .insert({
      restaurant_id: restaurant.restaurantId,
      table_session_id: null,
      status: "pending_payment",
      channel,
      fulfillment_type: fulfillment,
      guest_name: guestName || null,
      guest_phone: params.input.guestPhone?.trim() || null,
      guest_email: params.input.guestEmail?.trim() || null,
      delivery_address: params.input.deliveryAddress?.trim() || null,
      delivery_city: params.input.deliveryCity?.trim() || null,
      delivery_postal_code: params.input.deliveryPostalCode?.trim() || null,
      delivery_notes: params.input.deliveryNotes?.trim() || null,
      delivery_fee_cents: deliveryFeeCents,
      dining_table_id: params.input.diningTableId?.trim() || null,
      guest_status_token: statusToken,
      kds_status_id: kdsStatusId,
      subtotal_cents: priced.subtotalCents,
      total_cents: totalCents,
      notes: params.input.notes?.trim() || null,
      created_by_profile_id: null,
      slot_start_at: slotStartAt,
      slot_end_at: slotEndAt,
      fulfillment_asap: fulfillmentAsap,
    })
    .select("id, order_number")
    .single();

  if (orderError || !order) {
    console.warn("[ordering] create order", orderError?.message);
    return { ok: false, error: "create_order_failed", status: 500 };
  }

  const { error: linesError } = await admin.from("pos_order_lines").insert(
    priced.lineRows.map((row) => ({ ...row, order_id: order.id })),
  );

  if (linesError) {
    console.warn("[ordering] create lines", linesError.message);
    await admin.from("pos_orders").delete().eq("id", order.id);
    return { ok: false, error: "create_order_lines_failed", status: 500 };
  }

  // Counter kiosk: Mollie pointofsale terminal
  if (wantTerminal) {
    if (!terminalId.startsWith("term_")) {
      await admin.from("pos_orders").delete().eq("id", order.id);
      return { ok: false, error: "terminal_required", status: 400 };
    }
    const { createMolliePosPayment } = await import(
      "@/lib/pos/mollie-pos-payment"
    );
    const terminalPay = await createMolliePosPayment({
      restaurantId: restaurant.restaurantId,
      amountEuros: totalCents / 100,
      description: `Kiosk #${order.order_number} · ${restaurant.name}`,
      terminalId,
      posOrderId: order.id as string,
    });
    if (!terminalPay.ok) {
      await admin
        .from("pos_orders")
        .update({
          status: "cancelled",
          completed_at: new Date().toISOString(),
        })
        .eq("id", order.id);
      return {
        ok: false,
        error: terminalPay.error,
        status: terminalPay.status,
      };
    }
    if (terminalPay.status === "paid") {
      await markGuestOrderPaidByOrderId(order.id as string);
    }
    return {
      ok: true,
      orderId: order.id as string,
      orderNumber: order.order_number as number,
      statusToken,
      checkoutUrl: null,
      guestPaymentId: null,
      molliePaymentId: terminalPay.molliePaymentId,
      paymentMode: "terminal",
      totalCents,
    };
  }

  const redirectTemplate =
    params.redirectPathTemplate ??
    `/order/${restaurant.slug}/status/{token}?paid=1`;
  const redirectUrl = `${siteBase()}${redirectTemplate.replace(
    "{token}",
    statusToken,
  )}`;
  const cancelUrl = `${siteBase()}/order/${restaurant.slug}/status/${statusToken}`;

  const payment = await createRestaurantGuestPayment({
    restaurantId: restaurant.restaurantId,
    amountEuros: totalCents / 100,
    description: `Bestellung #${order.order_number} · ${restaurant.name}`,
    purpose: "order",
    redirectUrl,
    cancelUrl,
    metadata: {
      order_id: order.id as string,
      status_token: statusToken,
      channel,
    },
  });

  if (!payment.ok) {
    await admin
      .from("pos_orders")
      .update({ status: "cancelled", completed_at: new Date().toISOString() })
      .eq("id", order.id);
    return {
      ok: false,
      error: payment.error,
      status: payment.status,
    };
  }

  await admin
    .from("pos_orders")
    .update({ guest_payment_id: payment.id })
    .eq("id", order.id);

  await admin
    .from("restaurant_guest_payments")
    .update({ pos_order_id: order.id })
    .eq("id", payment.id);

  return {
    ok: true,
    orderId: order.id as string,
    orderNumber: order.order_number as number,
    statusToken,
    checkoutUrl: payment.checkoutUrl,
    guestPaymentId: payment.id,
    molliePaymentId: payment.molliePaymentId,
    paymentMode: "hosted",
    totalCents,
  };
}

async function priceGuestLines(params: {
  supabase: SupabaseClient;
  restaurantId: string;
  items: GuestCheckoutInput["items"];
}): Promise<
  | {
      ok: true;
      subtotalCents: number;
      lineRows: Array<Record<string, unknown>>;
    }
  | { ok: false; error: string; status: number }
> {
  const menuItemIds = [...new Set(params.items.map((i) => i.menuItemId))];
  const { data: menuItems, error: menuError } = await params.supabase
    .from("menu_items")
    .select(
      "id, name, price, vat_rate, is_active, restaurant_id, available_from, available_to",
    )
    .in("id", menuItemIds)
    .eq("restaurant_id", params.restaurantId);

  if (menuError || !menuItems?.length) {
    return { ok: false, error: "menu_items_not_found", status: 400 };
  }

  const menuById = new Map(menuItems.map((m) => [m.id as string, m]));
  const restaurantTimeZone = await fetchRestaurantTimezoneServer(
    params.supabase,
    params.restaurantId,
  );

  let subtotalCents = 0;
  const lineRows: Array<Record<string, unknown>> = [];

  for (let i = 0; i < params.items.length; i++) {
    const input = params.items[i]!;
    const menuItem = menuById.get(input.menuItemId);
    if (
      !menuItem ||
      !isMenuItemPubliclyAvailable(
        {
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
        },
        new Date(),
        restaurantTimeZone,
      )
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
      course: 2,
      ohne_ingredient_ids: ohneIds,
      modifiers,
      position: i,
    });
  }

  return { ok: true, subtotalCents, lineRows };
}

export async function markGuestOrderPaidByOrderId(
  orderId: string,
  guestPaymentId?: string | null,
): Promise<{ updated: boolean }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { updated: false };

  const { data: order } = await admin
    .from("pos_orders")
    .select("id, status")
    .eq("id", orderId)
    .maybeSingle();

  if (!order || order.status !== "pending_payment") {
    return { updated: false };
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: "received",
    accepted_at: now,
  };
  if (guestPaymentId) patch.guest_payment_id = guestPaymentId;

  const { error } = await admin
    .from("pos_orders")
    .update(patch)
    .eq("id", orderId)
    .eq("status", "pending_payment");

  if (error) {
    console.warn("[ordering] mark paid", error.message);
    return { updated: false };
  }

  void import("@/lib/ordering/guest-order-notify-server").then((m) =>
    m.notifyGuestOrderStatusChange({ orderId, status: "received" }),
  );

  return { updated: true };
}

export async function markGuestOrderPaidFromPayment(
  paymentId: string,
): Promise<{ updated: boolean }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { updated: false };

  // Guest hosted payment
  const { data: payment } = await admin
    .from("restaurant_guest_payments")
    .select("id, status, pos_order_id, metadata")
    .eq("mollie_payment_id", paymentId)
    .maybeSingle();

  if (payment?.status === "paid") {
    let orderId = (payment.pos_order_id as string | null) ?? null;
    if (!orderId) {
      const meta = payment.metadata as Record<string, string> | null;
      orderId = meta?.order_id ?? null;
    }
    if (orderId) {
      return markGuestOrderPaidByOrderId(orderId, payment.id as string);
    }
  }

  // Kiosk terminal: pos_payments row with metadata.pos_order_id
  const { data: posPay } = await admin
    .from("pos_payments")
    .select("id, status, order_id")
    .eq("mollie_payment_id", paymentId)
    .maybeSingle();

  if (posPay?.status === "paid" && posPay.order_id) {
    return markGuestOrderPaidByOrderId(posPay.order_id as string);
  }

  return { updated: false };
}

export type GuestOrderStatusDto = {
  orderNumber: number;
  status: string;
  statusLabel: string;
  channel: PosOrderChannel | string;
  fulfillmentType: PosFulfillmentType | string;
  totalCents: number;
  deliveryFeeCents: number;
  guestName: string | null;
  restaurantName: string;
  restaurantSlug: string;
  createdAt: string;
  acceptedAt: string | null;
  readyAt: string | null;
  outForDeliveryAt: string | null;
  completedAt: string | null;
  slotStartAt: string | null;
  slotEndAt: string | null;
  fulfillmentAsap: boolean;
  deliveryLat: number | null;
  deliveryLng: number | null;
  deliveryLocationUpdatedAt: string | null;
  deliveryTrackingActive: boolean;
  lines: Array<{
    name: string;
    quantity: number;
    lineTotalCents: number;
    modifiers: unknown;
  }>;
  paymentStatus: string | null;
  checkoutUrl: string | null;
  message: string | null;
};

export async function loadGuestOrderStatusByToken(
  token: string,
): Promise<
  | { ok: true; order: GuestOrderStatusDto }
  | { ok: false; error: string; status: number }
> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "server_misconfigured", status: 503 };

  const trimmed = token.trim();
  if (!trimmed || trimmed.length < 16) {
    return { ok: false, error: "not_found", status: 404 };
  }

  const { data: order, error } = await admin
    .from("pos_orders")
    .select(
      `
      id, order_number, status, channel, fulfillment_type, total_cents,
      delivery_fee_cents, guest_name, created_at, accepted_at, ready_at,
      out_for_delivery_at, completed_at, guest_payment_id, restaurant_id,
      slot_start_at, slot_end_at, fulfillment_asap, delivery_lat, delivery_lng,
      delivery_location_updated_at, delivery_tracking_active
    `,
    )
    .eq("guest_status_token", trimmed)
    .maybeSingle();

  if (error || !order) {
    return { ok: false, error: "not_found", status: 404 };
  }

  const [{ data: restaurant }, { data: lines }, settings, paymentRow] =
    await Promise.all([
      admin
        .from("restaurants")
        .select("name, slug")
        .eq("id", order.restaurant_id as string)
        .maybeSingle(),
      admin
        .from("pos_order_lines")
        .select("name, quantity, line_total_cents, modifiers")
        .eq("order_id", order.id as string)
        .order("position", { ascending: true }),
      loadOnlineOrderingSettings(admin, order.restaurant_id as string),
      order.guest_payment_id
        ? admin
            .from("restaurant_guest_payments")
            .select("status, checkout_url")
            .eq("id", order.guest_payment_id as string)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const { guestOrderStatusLabelDe } = await import(
    "@/lib/ordering/guest-order-labels"
  );

  return {
    ok: true,
    order: {
      orderNumber: order.order_number as number,
      status: order.status as string,
      statusLabel: guestOrderStatusLabelDe(
        order.status as string,
        order.fulfillment_type as string,
      ),
      channel: order.channel as string,
      fulfillmentType: order.fulfillment_type as string,
      totalCents: Number(order.total_cents) || 0,
      deliveryFeeCents: Number(order.delivery_fee_cents) || 0,
      guestName: (order.guest_name as string | null) ?? null,
      restaurantName: String(restaurant?.name ?? ""),
      restaurantSlug: String(restaurant?.slug ?? ""),
      createdAt: order.created_at as string,
      acceptedAt: (order.accepted_at as string | null) ?? null,
      readyAt: (order.ready_at as string | null) ?? null,
      outForDeliveryAt: (order.out_for_delivery_at as string | null) ?? null,
      completedAt: (order.completed_at as string | null) ?? null,
      slotStartAt: (order.slot_start_at as string | null) ?? null,
      slotEndAt: (order.slot_end_at as string | null) ?? null,
      fulfillmentAsap: order.fulfillment_asap !== false,
      deliveryLat:
        typeof order.delivery_lat === "number" ? order.delivery_lat : null,
      deliveryLng:
        typeof order.delivery_lng === "number" ? order.delivery_lng : null,
      deliveryLocationUpdatedAt:
        (order.delivery_location_updated_at as string | null) ?? null,
      deliveryTrackingActive: Boolean(order.delivery_tracking_active),
      lines: (lines ?? []).map((l) => ({
        name: l.name as string,
        quantity: Number(l.quantity) || 0,
        lineTotalCents: Number(l.line_total_cents) || 0,
        modifiers: l.modifiers,
      })),
      paymentStatus: (paymentRow?.data?.status as string | null) ?? null,
      checkoutUrl: (paymentRow?.data?.checkout_url as string | null) ?? null,
      message: settings.guestStatusMessage,
    },
  };
}

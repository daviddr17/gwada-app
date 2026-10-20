import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export async function startDeliveryTracking(params: {
  supabase: SupabaseClient;
  restaurantId: string;
  orderId: string;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const { data: order, error } = await params.supabase
    .from("pos_orders")
    .select("id, restaurant_id, status, fulfillment_type")
    .eq("id", params.orderId)
    .maybeSingle();

  if (error || !order) {
    return { ok: false, error: "order_not_found", status: 404 };
  }
  if (order.restaurant_id !== params.restaurantId) {
    return { ok: false, error: "forbidden", status: 403 };
  }
  if (order.fulfillment_type !== "delivery") {
    return { ok: false, error: "not_delivery", status: 400 };
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    delivery_tracking_active: true,
  };
  if (order.status === "ready" || order.status === "preparing") {
    patch.status = "out_for_delivery";
    patch.out_for_delivery_at = now;
  } else if (order.status !== "out_for_delivery") {
    return { ok: false, error: "invalid_status_for_tracking", status: 400 };
  }

  const { error: upd } = await params.supabase
    .from("pos_orders")
    .update(patch)
    .eq("id", params.orderId);

  if (upd) return { ok: false, error: "update_failed", status: 500 };
  return { ok: true };
}

export async function recordDeliveryLocation(params: {
  supabase: SupabaseClient;
  restaurantId: string;
  orderId: string;
  lat: number;
  lng: number;
  profileId?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (
    !Number.isFinite(params.lat) ||
    !Number.isFinite(params.lng) ||
    Math.abs(params.lat) > 90 ||
    Math.abs(params.lng) > 180
  ) {
    return { ok: false, error: "invalid_coordinates", status: 400 };
  }

  const { data: order, error } = await params.supabase
    .from("pos_orders")
    .select("id, restaurant_id, status, delivery_tracking_active")
    .eq("id", params.orderId)
    .maybeSingle();

  if (error || !order) {
    return { ok: false, error: "order_not_found", status: 404 };
  }
  if (order.restaurant_id !== params.restaurantId) {
    return { ok: false, error: "forbidden", status: 403 };
  }
  if (order.status !== "out_for_delivery" && !order.delivery_tracking_active) {
    return { ok: false, error: "tracking_inactive", status: 400 };
  }

  const now = new Date().toISOString();
  const { error: locErr } = await params.supabase
    .from("pos_order_delivery_locations")
    .insert({
      order_id: params.orderId,
      restaurant_id: params.restaurantId,
      lat: params.lat,
      lng: params.lng,
      recorded_at: now,
      recorded_by_profile_id: params.profileId ?? null,
    });

  if (locErr) {
    console.warn("[ordering] location insert", locErr.message);
    return { ok: false, error: "insert_failed", status: 500 };
  }

  await params.supabase
    .from("pos_orders")
    .update({
      delivery_lat: params.lat,
      delivery_lng: params.lng,
      delivery_location_updated_at: now,
      delivery_tracking_active: true,
    })
    .eq("id", params.orderId);

  return { ok: true };
}

export async function stopDeliveryTracking(params: {
  supabase: SupabaseClient;
  restaurantId: string;
  orderId: string;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const { error } = await params.supabase
    .from("pos_orders")
    .update({ delivery_tracking_active: false })
    .eq("id", params.orderId)
    .eq("restaurant_id", params.restaurantId);

  if (error) return { ok: false, error: "update_failed", status: 500 };
  return { ok: true };
}

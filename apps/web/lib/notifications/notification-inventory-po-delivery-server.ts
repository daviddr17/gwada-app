import "server-only";

import {
  isPurchaseOrderDeliveryDue,
  purchaseOrderDeliveryDueKind,
} from "@/lib/inventory/purchase-order-delivery-due";
import { APP_ROUTES } from "@/lib/navigation/app-routes";
import { restaurantTodayYmd } from "@/lib/restaurant/restaurant-timezone";
import { fetchRestaurantTimezoneServer } from "@/lib/supabase/restaurant-timezone-server";
import type { SupabaseClient } from "@supabase/supabase-js";

function formatDeliveryYmdDe(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${d}.${m}.${y}`;
}

async function fetchDismissedOrderIdsForToday(
  sb: SupabaseClient,
  params: { profileId: string; restaurantId: string; todayYmd: string },
): Promise<Set<string>> {
  const { data } = await sb
    .from("restaurant_inventory_po_delivery_dismissals")
    .select("order_id")
    .eq("profile_id", params.profileId)
    .eq("restaurant_id", params.restaurantId)
    .eq("dismissed_on_ymd", params.todayYmd);

  return new Set(
    (data ?? []).map((row) => (row as { order_id: string }).order_id),
  );
}

export async function loadInventoryPoDeliveryDueBellSummary(
  sb: SupabaseClient,
  params: { restaurantId: string; userId: string; limit?: number },
) {
  const timeZone = await fetchRestaurantTimezoneServer(sb, params.restaurantId);
  const todayYmd = restaurantTodayYmd(timeZone);
  const dismissed = await fetchDismissedOrderIdsForToday(sb, {
    profileId: params.userId,
    restaurantId: params.restaurantId,
    todayYmd,
  });

  const { data: orders, error } = await sb
    .from("inventory_purchase_orders")
    .select("id, supplier_name, status, delivery_date, updated_at")
    .eq("restaurant_id", params.restaurantId)
    .eq("status", "ordered")
    .not("delivery_date", "is", null)
    .lte("delivery_date", todayYmd)
    .order("delivery_date", { ascending: true });

  if (error) {
    console.warn("[gwada] inventory po delivery due bell", error.message);
    return { items: [], totalCount: 0 };
  }

  const due = (orders ?? [])
    .map((row) => {
      const r = row as {
        id: string;
        supplier_name: string;
        status: string;
        delivery_date: string | null;
        updated_at: string;
      };
      return {
        id: r.id,
        supplierName: r.supplier_name?.trim() || "Lieferant",
        status: r.status as "open" | "ordered" | "closed",
        deliveryDate: r.delivery_date,
        updatedAt: r.updated_at,
      };
    })
    .filter((o) => isPurchaseOrderDeliveryDue(o, todayYmd))
    .filter((o) => !dismissed.has(o.id));

  const limit = params.limit ?? 5;
  const items = due.slice(0, limit).map((o) => {
    const deliveryDate = o.deliveryDate!.trim();
    const kind = purchaseOrderDeliveryDueKind(deliveryDate, todayYmd);
    return {
      id: o.id,
      title: o.supplierName,
      subtitle:
        kind === "today"
          ? `Lieferung heute · ${formatDeliveryYmdDe(deliveryDate)}`
          : `Überfällig · ${formatDeliveryYmdDe(deliveryDate)}`,
      href: APP_ROUTES.inventory.order,
      at: o.updatedAt,
      meta: { orderId: o.id, deliveryDate, kind },
    };
  });

  return { items, totalCount: due.length };
}

export async function dismissInventoryPoDeliveryDueNotification(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    orderId: string;
  },
): Promise<{ error: string | null }> {
  const timeZone = await fetchRestaurantTimezoneServer(sb, params.restaurantId);
  const todayYmd = restaurantTodayYmd(timeZone);
  const { error } = await sb
    .from("restaurant_inventory_po_delivery_dismissals")
    .upsert(
      {
        profile_id: params.userId,
        restaurant_id: params.restaurantId,
        order_id: params.orderId,
        dismissed_on_ymd: todayYmd,
      },
      { onConflict: "profile_id,restaurant_id,order_id,dismissed_on_ymd" },
    );

  return { error: error?.message ?? null };
}

export async function dismissAllInventoryPoDeliveryDueNotifications(
  sb: SupabaseClient,
  params: { restaurantId: string; userId: string },
): Promise<{ error: string | null }> {
  const timeZone = await fetchRestaurantTimezoneServer(sb, params.restaurantId);
  const todayYmd = restaurantTodayYmd(timeZone);
  const dismissed = await fetchDismissedOrderIdsForToday(sb, {
    profileId: params.userId,
    restaurantId: params.restaurantId,
    todayYmd,
  });

  const { data: orders, error: orderError } = await sb
    .from("inventory_purchase_orders")
    .select("id, status, delivery_date")
    .eq("restaurant_id", params.restaurantId)
    .eq("status", "ordered")
    .not("delivery_date", "is", null)
    .lte("delivery_date", todayYmd);

  if (orderError) return { error: orderError.message };

  const orderIds = (orders ?? [])
    .map((row) => {
      const r = row as {
        id: string;
        status: string;
        delivery_date: string | null;
      };
      return {
        id: r.id,
        status: r.status as "open" | "ordered" | "closed",
        deliveryDate: r.delivery_date,
      };
    })
    .filter((o) => isPurchaseOrderDeliveryDue(o, todayYmd))
    .filter((o) => !dismissed.has(o.id))
    .map((o) => o.id);

  if (orderIds.length === 0) return { error: null };

  const rows = orderIds.map((orderId) => ({
    profile_id: params.userId,
    restaurant_id: params.restaurantId,
    order_id: orderId,
    dismissed_on_ymd: todayYmd,
  }));

  const { error } = await sb
    .from("restaurant_inventory_po_delivery_dismissals")
    .upsert(rows, {
      onConflict: "profile_id,restaurant_id,order_id,dismissed_on_ymd",
    });

  return { error: error?.message ?? null };
}

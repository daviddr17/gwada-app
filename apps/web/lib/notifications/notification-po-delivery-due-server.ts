import "server-only";

import {
  isPurchaseOrderDeliveryDue,
  purchaseOrderDeliveryDueKind,
} from "@/lib/inventory/purchase-order-delivery-due";
import { APP_ROUTES } from "@/lib/navigation/app-routes";
import { scheduleDeliverForNotificationReferences } from "@/lib/notifications/schedule-notification-deliver";
import { restaurantTodayYmd } from "@/lib/restaurant/restaurant-timezone";
import { fetchRestaurantTimezoneServer } from "@/lib/supabase/restaurant-timezone-server";
import type { SupabaseClient } from "@supabase/supabase-js";

const DUE_PO_DELIVERY_EMIT_LIMIT = 120;

export type DuePoDeliveryNotifyCronStats = {
  scanned: number;
  emitted: number;
  skippedExisting: number;
  errors: number;
};

/**
 * Bestellte Bestellungen mit Lieferdatum ≤ Restaurant-Heute → notification_events.
 * Ein Event pro Bestellung und Kalendertag (reference_id = orderId:deliveryDate:today).
 * Push nur wenn Nutzer in Prefs WhatsApp/E-Mail für inventory_po_delivery_due aktiviert.
 */
export async function emitDuePurchaseOrderDeliveryPushEvents(
  admin: SupabaseClient,
): Promise<DuePoDeliveryNotifyCronStats> {
  const stats: DuePoDeliveryNotifyCronStats = {
    scanned: 0,
    emitted: 0,
    skippedExisting: 0,
    errors: 0,
  };

  const { data: orderRows, error } = await admin
    .from("inventory_purchase_orders")
    .select("id, restaurant_id, supplier_name, status, delivery_date")
    .eq("status", "ordered")
    .not("delivery_date", "is", null)
    .order("delivery_date", { ascending: true })
    .limit(DUE_PO_DELIVERY_EMIT_LIMIT);

  if (error) {
    console.warn("[po-delivery-notify] query", error.message);
    stats.errors += 1;
    return stats;
  }

  const rows = (orderRows ?? []) as Array<{
    id: string;
    restaurant_id: string;
    supplier_name: string | null;
    status: string;
    delivery_date: string | null;
  }>;

  const tzCache = new Map<string, string>();
  const emittedByRestaurant = new Map<string, string[]>();

  for (const row of rows) {
    stats.scanned += 1;
    let timeZone = tzCache.get(row.restaurant_id);
    if (!timeZone) {
      timeZone = await fetchRestaurantTimezoneServer(admin, row.restaurant_id);
      tzCache.set(row.restaurant_id, timeZone);
    }
    const todayYmd = restaurantTodayYmd(timeZone);
    const order = {
      status: row.status as "open" | "ordered" | "closed",
      deliveryDate: row.delivery_date,
    };
    if (!isPurchaseOrderDeliveryDue(order, todayYmd)) continue;

    const deliveryDate = row.delivery_date!.trim();
    const kind = purchaseOrderDeliveryDueKind(deliveryDate, todayYmd);
    const referenceId = `${row.id}:${deliveryDate}:${todayYmd}`;

    const { data: existing } = await admin
      .from("notification_events")
      .select("id")
      .eq("module", "inventory_po_delivery_due")
      .eq("reference_id", referenceId)
      .eq("restaurant_id", row.restaurant_id)
      .maybeSingle();

    if (existing) {
      stats.skippedExisting += 1;
      continue;
    }

    const supplierName = row.supplier_name?.trim() || "Lieferant";
    const { error: insertErr } = await admin.from("notification_events").insert({
      restaurant_id: row.restaurant_id,
      module: "inventory_po_delivery_due",
      reference_id: referenceId,
      payload: {
        orderId: row.id,
        supplierName,
        deliveryDate,
        kind,
        href: APP_ROUTES.inventory.order,
      },
    });

    if (insertErr) {
      console.warn("[po-delivery-notify] emit", insertErr.message);
      stats.errors += 1;
      continue;
    }

    stats.emitted += 1;
    const list = emittedByRestaurant.get(row.restaurant_id) ?? [];
    list.push(referenceId);
    emittedByRestaurant.set(row.restaurant_id, list);
  }

  for (const [restaurantId, refs] of emittedByRestaurant) {
    await scheduleDeliverForNotificationReferences(admin, {
      restaurantId,
      module: "inventory_po_delivery_due",
      referenceIds: refs,
    });
  }

  return stats;
}

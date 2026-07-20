import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { posRestaurantYmdRangeBounds } from "@/lib/pos/pos-day-range-server";

export type PosOrderListStatusFilter =
  | "all"
  | "open"
  | "delivered"
  | "cancelled";

export type PosOrderListItem = {
  id: string;
  orderNumber: number;
  status: string;
  totalCents: number;
  tipCents: number;
  tableSessionId: string;
  tableLabel: string;
  createdAt: string;
  closedAt: string | null;
  lineCount: number;
  itemQuantity: number;
  linePreview: string;
};

const OPEN_STATUSES = [
  "pending_payment",
  "received",
  "preparing",
  "ready",
] as const;

function isYmd(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Bestellungen im Kalendertag-Bereich (Restaurant-TZ), leichtgewichtig für Dashboard. */
export async function listPosOrdersInRange(
  supabase: SupabaseClient,
  restaurantId: string,
  fromYmd: string,
  toYmd: string,
  status: PosOrderListStatusFilter = "all",
): Promise<PosOrderListItem[]> {
  if (!isYmd(fromYmd) || !isYmd(toYmd) || fromYmd > toYmd) return [];

  const bounds = await posRestaurantYmdRangeBounds(
    restaurantId,
    fromYmd,
    toYmd,
  );
  if (!bounds) return [];

  let query = supabase
    .from("pos_orders")
    .select(
      "id, order_number, status, total_cents, tip_cents, table_session_id, created_at, closed_at",
    )
    .eq("restaurant_id", restaurantId)
    .gte("created_at", bounds.startAt)
    .lt("created_at", bounds.endAt)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (status === "open") {
    query = query.in("status", [...OPEN_STATUSES]);
  } else if (status === "delivered") {
    query = query.eq("status", "delivered");
  } else if (status === "cancelled") {
    query = query.eq("status", "cancelled");
  }

  const { data: orders, error } = await query;
  if (error) {
    console.warn("[pos] orders list", error.message);
    return [];
  }
  if (!orders?.length) return [];

  const orderIds = orders.map((o) => o.id as string);
  const sessionIds = [
    ...new Set(
      orders.map((o) => o.table_session_id as string).filter(Boolean),
    ),
  ];

  const [{ data: lines }, { data: sessions }] = await Promise.all([
    supabase
      .from("pos_order_lines")
      .select("order_id, name, quantity, position")
      .in("order_id", orderIds)
      .order("position", { ascending: true }),
    sessionIds.length
      ? supabase
          .from("pos_table_sessions")
          .select("id, dining_table_id")
          .in("id", sessionIds)
      : Promise.resolve({ data: [] as { id: string; dining_table_id: string }[] }),
  ]);

  const tableIds = [
    ...new Set(
      (sessions ?? []).map((s) => s.dining_table_id as string).filter(Boolean),
    ),
  ];
  const { data: tables } = tableIds.length
    ? await supabase
        .from("dining_tables")
        .select("id, table_number, table_name")
        .in("id", tableIds)
    : { data: [] as { id: string; table_number: string | null; table_name: string | null }[] };

  const tableById = new Map(
    (tables ?? []).map((t) => [t.id as string, t] as const),
  );
  const sessionById = new Map(
    (sessions ?? []).map((s) => [s.id as string, s] as const),
  );

  const linesByOrder = new Map<
    string,
    Array<{ name: string; quantity: number }>
  >();
  for (const line of lines ?? []) {
    const orderId = line.order_id as string;
    const list = linesByOrder.get(orderId) ?? [];
    list.push({
      name: String(line.name ?? ""),
      quantity: Number(line.quantity ?? 0),
    });
    linesByOrder.set(orderId, list);
  }

  return orders.map((order) => {
    const orderLines = linesByOrder.get(order.id as string) ?? [];
    const session = sessionById.get(order.table_session_id as string);
    const table = session
      ? tableById.get(session.dining_table_id as string)
      : null;
    const tableLabel =
      table?.table_name?.trim() ||
      (table?.table_number != null ? `Tisch ${table.table_number}` : "—");
    const preview = orderLines
      .slice(0, 4)
      .map((l) => `${l.quantity}× ${l.name}`)
      .join(", ");
    const more =
      orderLines.length > 4 ? ` (+${orderLines.length - 4})` : "";

    return {
      id: order.id as string,
      orderNumber: Number(order.order_number),
      status: String(order.status),
      totalCents: Number(order.total_cents ?? 0),
      tipCents: Number(order.tip_cents ?? 0),
      tableSessionId: String(order.table_session_id ?? ""),
      tableLabel,
      createdAt: String(order.created_at),
      closedAt: (order.closed_at as string | null) ?? null,
      lineCount: orderLines.length,
      itemQuantity: orderLines.reduce((sum, l) => sum + l.quantity, 0),
      linePreview: preview ? `${preview}${more}` : "—",
    };
  });
}

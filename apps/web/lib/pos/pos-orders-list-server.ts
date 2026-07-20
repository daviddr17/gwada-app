import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  clampListPage,
  clampListPageSize,
  listPageRange,
  totalPagesFromCount,
  type PaginatedListResult,
} from "@/lib/constants/list-pagination";
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

export type PosOrderListOptions = {
  status?: PosOrderListStatusFilter;
  search?: string | null;
  page?: number | null;
  pageSize?: number | null;
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

function emptyPage(
  page: number,
  pageSize: number,
): PaginatedListResult<PosOrderListItem> {
  return {
    items: [],
    page: Math.max(1, page),
    pageSize,
    totalCount: 0,
    totalPages: 1,
  };
}

/** Bestellungen im Kalendertag-Bereich (Restaurant-TZ), server-paginiert. */
export async function listPosOrdersInRange(
  supabase: SupabaseClient,
  restaurantId: string,
  fromYmd: string,
  toYmd: string,
  options: PosOrderListOptions = {},
): Promise<PaginatedListResult<PosOrderListItem>> {
  const pageSize = clampListPageSize(options.pageSize);
  const requestedPage = Math.max(1, options.page ?? 1);
  const status = options.status ?? "all";
  const search = options.search?.trim() ?? "";

  if (!isYmd(fromYmd) || !isYmd(toYmd) || fromYmd > toYmd) {
    return emptyPage(requestedPage, pageSize);
  }

  const bounds = await posRestaurantYmdRangeBounds(
    restaurantId,
    fromYmd,
    toYmd,
  );
  if (!bounds) return emptyPage(requestedPage, pageSize);

  let countQuery = supabase
    .from("pos_orders")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .gte("created_at", bounds.startAt)
    .lt("created_at", bounds.endAt);

  let dataQuery = supabase
    .from("pos_orders")
    .select(
      "id, order_number, status, total_cents, tip_cents, table_session_id, created_at, closed_at",
    )
    .eq("restaurant_id", restaurantId)
    .gte("created_at", bounds.startAt)
    .lt("created_at", bounds.endAt)
    .order("created_at", { ascending: false });

  if (status === "open") {
    countQuery = countQuery.in("status", [...OPEN_STATUSES]);
    dataQuery = dataQuery.in("status", [...OPEN_STATUSES]);
  } else if (status === "delivered") {
    countQuery = countQuery.eq("status", "delivered");
    dataQuery = dataQuery.eq("status", "delivered");
  } else if (status === "cancelled") {
    countQuery = countQuery.eq("status", "cancelled");
    dataQuery = dataQuery.eq("status", "cancelled");
  }

  if (search) {
    const asNum = Number.parseInt(search, 10);
    if (Number.isFinite(asNum) && String(asNum) === search) {
      countQuery = countQuery.eq("order_number", asNum);
      dataQuery = dataQuery.eq("order_number", asNum);
    }
  }

  const { count, error: countError } = await countQuery;
  if (countError) {
    console.warn("[pos] orders list count", countError.message);
    return emptyPage(requestedPage, pageSize);
  }

  const totalCount = count ?? 0;
  const totalPages = totalPagesFromCount(totalCount, pageSize);
  const page = clampListPage(requestedPage, totalPages);
  const { from, to } = listPageRange(page, pageSize);

  const { data: orders, error } = await dataQuery.range(from, to);
  if (error) {
    console.warn("[pos] orders list", error.message);
    return emptyPage(page, pageSize);
  }
  if (!orders?.length) {
    return { items: [], page, pageSize, totalCount, totalPages };
  }

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
      : Promise.resolve({
          data: [] as { id: string; dining_table_id: string }[],
        }),
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
    : {
        data: [] as {
          id: string;
          table_number: string | null;
          table_name: string | null;
        }[],
      };

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

  const items = orders.map((order) => {
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

  return { items, page, pageSize, totalCount, totalPages };
}

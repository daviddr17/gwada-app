import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  clampListPage,
  clampListPageSize,
  listPageRange,
  totalPagesFromCount,
  type PaginatedListResult,
} from "@/lib/constants/list-pagination";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  posRestaurantTodayYmd,
  posRestaurantYmdRangeBounds,
} from "@/lib/pos/pos-day-range-server";
import { resolvePosReceiptSignedUrl } from "@/lib/pos/receipt-storage";

export type PosReceiptListItem = {
  paymentId: string;
  orderId: string;
  orderNumber: number;
  tableSessionId: string;
  tableLabel: string;
  diningTableId: string;
  sessionStatus: string;
  method: string;
  status: string;
  amountCents: number;
  tipCents: number;
  receivedAmountCents: number | null;
  paidAt: string | null;
  canVoidCash: boolean;
  receiptPdfUrl: string | null;
};

export type PosReceiptListOptions = {
  page?: number | null;
  pageSize?: number | null;
  /** all | cash | card | other | refunded */
  method?: string | null;
  search?: string | null;
};

async function resolveReceiptPdfUrl(params: {
  orderReceiptPath: string | null;
  paymentFiscalPath: string | null;
  paymentPublicUrl: string | null;
  orderFiscalPath: string | null;
  orderPublicUrl: string | null;
}): Promise<string | null> {
  const storagePath =
    params.paymentFiscalPath?.trim() ||
    params.orderReceiptPath?.trim() ||
    params.orderFiscalPath?.trim() ||
    null;
  if (storagePath) {
    const signed = await resolvePosReceiptSignedUrl(storagePath);
    if (signed) return signed;
  }
  return (
    params.paymentPublicUrl?.trim() ||
    params.orderPublicUrl?.trim() ||
    null
  );
}

function emptyPage(
  page: number,
  pageSize: number,
): PaginatedListResult<PosReceiptListItem> {
  return {
    items: [],
    page: Math.max(1, page),
    pageSize,
    totalCount: 0,
    totalPages: 1,
  };
}

function methodMatchFilter(
  method: string,
  filter: string,
): boolean {
  const m = method.trim().toLowerCase();
  if (filter === "cash") return m === "cash" || m === "bar";
  if (filter === "card") {
    return (
      m === "card" ||
      m === "karte" ||
      m === "mollie" ||
      m === "terminal"
    );
  }
  if (filter === "other") {
    return !(
      m === "cash" ||
      m === "bar" ||
      m === "card" ||
      m === "karte" ||
      m === "mollie" ||
      m === "terminal"
    );
  }
  return true;
}

/** Quittungen / Zahlungen — server-paginiert. */
export async function listPosReceiptsInRange(
  supabase: SupabaseClient,
  restaurantId: string,
  fromYmd: string,
  toYmd: string,
  options: PosReceiptListOptions = {},
): Promise<PaginatedListResult<PosReceiptListItem>> {
  const pageSize = clampListPageSize(options.pageSize);
  const requestedPage = Math.max(1, options.page ?? 1);
  const methodFilter = (options.method ?? "all").trim().toLowerCase();
  const search = options.search?.trim() ?? "";

  const bounds = await posRestaurantYmdRangeBounds(
    restaurantId,
    fromYmd,
    toYmd,
  );
  if (!bounds) return emptyPage(requestedPage, pageSize);

  let countQuery = supabase
    .from("pos_payments")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .gte("paid_at", bounds.startAt)
    .lt("paid_at", bounds.endAt);

  let dataQuery = supabase
    .from("pos_payments")
    .select(
      "id, order_id, method, status, amount_cents, tip_cents, received_amount_cents, paid_at",
    )
    .eq("restaurant_id", restaurantId)
    .gte("paid_at", bounds.startAt)
    .lt("paid_at", bounds.endAt)
    .order("paid_at", { ascending: false });

  if (methodFilter === "refunded") {
    countQuery = countQuery.eq("status", "refunded");
    dataQuery = dataQuery.eq("status", "refunded");
  } else {
    countQuery = countQuery.in("status", ["paid", "refunded"]);
    dataQuery = dataQuery.in("status", ["paid", "refunded"]);
    if (methodFilter === "cash") {
      countQuery = countQuery.in("method", ["cash", "bar"]);
      dataQuery = dataQuery.in("method", ["cash", "bar"]);
    } else if (methodFilter === "card") {
      countQuery = countQuery.in("method", [
        "card",
        "karte",
        "mollie",
        "terminal",
      ]);
      dataQuery = dataQuery.in("method", [
        "card",
        "karte",
        "mollie",
        "terminal",
      ]);
    }
  }

  const { count, error: countError } = await countQuery;
  if (countError) {
    console.warn("[pos] receipts count", countError.message);
    return emptyPage(requestedPage, pageSize);
  }

  const totalCount = count ?? 0;
  const totalPages = totalPagesFromCount(totalCount, pageSize);
  const page = clampListPage(requestedPage, totalPages);
  const { from, to } = listPageRange(page, pageSize);

  // For "other" we over-fetch a bit and filter — rare methods.
  const fetchTo =
    methodFilter === "other" || search
      ? Math.min(from + pageSize * 5 - 1, Math.max(totalCount - 1, 0))
      : to;

  const { data: payments, error } = await dataQuery.range(from, fetchTo);
  if (error) {
    console.warn("[pos] receipts range", error.message);
    return emptyPage(page, pageSize);
  }
  if (!payments?.length) {
    return { items: [], page, pageSize, totalCount, totalPages };
  }

  let filtered = payments;
  if (methodFilter === "other") {
    filtered = filtered.filter(
      (p) =>
        p.status !== "refunded" &&
        methodMatchFilter(String(p.method ?? ""), "other"),
    );
  }

  if (search) {
    const q = search.toLowerCase();
    const asNum = Number.parseInt(search, 10);
    // Prefetch orders for search match on bon number / later table
    const searchOrderIds = [
      ...new Set(filtered.map((p) => p.order_id as string)),
    ];
    const { data: searchOrders } = searchOrderIds.length
      ? await supabase
          .from("pos_orders")
          .select("id, order_number")
          .in("id", searchOrderIds)
      : { data: [] as { id: string; order_number: number }[] };
    const orderNumById = new Map(
      (searchOrders ?? []).map(
        (o) => [o.id as string, Number(o.order_number)] as const,
      ),
    );
    filtered = filtered.filter((p) => {
      const num = orderNumById.get(p.order_id as string) ?? 0;
      return (
        String(num).includes(q) ||
        (Number.isFinite(asNum) && num === asNum) ||
        String(p.method ?? "")
          .toLowerCase()
          .includes(q)
      );
    });
  }

  const pagePayments = filtered.slice(0, pageSize);

  const orderIds = [...new Set(pagePayments.map((p) => p.order_id as string))];
  const paymentIds = pagePayments.map((p) => p.id as string);

  const { data: orders } = orderIds.length
    ? await supabase
        .from("pos_orders")
        .select("id, order_number, table_session_id, receipt_url")
        .in("id", orderIds)
    : { data: [] as {
        id: string;
        order_number: number;
        table_session_id: string;
        receipt_url: string | null;
      }[] };

  const orderById = new Map(
    (orders ?? []).map((o) => [o.id as string, o] as const),
  );
  const sessionIds = [
    ...new Set(
      (orders ?? []).map((o) => o.table_session_id as string).filter(Boolean),
    ),
  ];

  const { data: sessions } = sessionIds.length
    ? await supabase
        .from("pos_table_sessions")
        .select("id, dining_table_id, status")
        .in("id", sessionIds)
    : {
        data: [] as {
          id: string;
          dining_table_id: string;
          status: string;
        }[],
      };

  const sessionById = new Map(
    (sessions ?? []).map((s) => [s.id as string, s] as const),
  );
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
          table_number: number;
          table_name: string | null;
        }[],
      };

  const tableById = new Map(
    (tables ?? []).map((t) => [t.id as string, t] as const),
  );

  const admin = createSupabaseAdminClient();
  const fiscalByPaymentId = new Map<
    string,
    { custom_receipt_url: string | null; receipt_public_url: string | null }
  >();
  const fiscalByOrderId = new Map<
    string,
    { custom_receipt_url: string | null; receipt_public_url: string | null }
  >();

  if (admin && paymentIds.length) {
    const { data: paymentFiscal } = await admin
      .from("pos_fiscal_transactions")
      .select("split_group, custom_receipt_url, receipt_public_url")
      .in("split_group", paymentIds);
    for (const row of paymentFiscal ?? []) {
      const key = row.split_group as string;
      if (key) {
        fiscalByPaymentId.set(key, {
          custom_receipt_url: row.custom_receipt_url as string | null,
          receipt_public_url: row.receipt_public_url as string | null,
        });
      }
    }

    const { data: orderFiscal } = await admin
      .from("pos_fiscal_transactions")
      .select("order_id, custom_receipt_url, receipt_public_url, split_group")
      .in("order_id", orderIds)
      .is("split_group", null);
    for (const row of orderFiscal ?? []) {
      fiscalByOrderId.set(row.order_id as string, {
        custom_receipt_url: row.custom_receipt_url as string | null,
        receipt_public_url: row.receipt_public_url as string | null,
      });
    }
  }

  const items = await Promise.all(
    pagePayments.map(async (p) => {
      const order = orderById.get(p.order_id as string);
      const session = order
        ? sessionById.get(order.table_session_id as string)
        : undefined;
      const table = session
        ? tableById.get(session.dining_table_id as string)
        : undefined;
      const name = table?.table_name?.trim();
      const tableLabel = name
        ? name
        : table
          ? `Tisch ${table.table_number}`
          : "—";

      const payFiscal = fiscalByPaymentId.get(p.id as string);
      const ordFiscal = fiscalByOrderId.get(p.order_id as string);
      const receiptPdfUrl = await resolveReceiptPdfUrl({
        orderReceiptPath: (order?.receipt_url as string | null) ?? null,
        paymentFiscalPath: payFiscal?.custom_receipt_url ?? null,
        paymentPublicUrl: payFiscal?.receipt_public_url ?? null,
        orderFiscalPath: ordFiscal?.custom_receipt_url ?? null,
        orderPublicUrl: ordFiscal?.receipt_public_url ?? null,
      });

      return {
        paymentId: p.id as string,
        orderId: p.order_id as string,
        orderNumber: Number(order?.order_number ?? 0),
        tableSessionId: (order?.table_session_id as string) ?? "",
        tableLabel,
        diningTableId: (session?.dining_table_id as string) ?? "",
        sessionStatus: (session?.status as string) ?? "—",
        method: String(p.method ?? ""),
        status: String(p.status ?? ""),
        amountCents: Number(p.amount_cents),
        tipCents: Number(p.tip_cents ?? 0),
        receivedAmountCents:
          p.received_amount_cents == null
            ? null
            : Number(p.received_amount_cents),
        paidAt: (p.paid_at as string | null) ?? null,
        canVoidCash: p.method === "cash" && p.status === "paid",
        receiptPdfUrl,
      };
    }),
  );

  // When client-side filtering reduced the set, report approximate totals for
  // simple filters (cash/card/refunded) we already counted in SQL.
  const effectiveTotal =
    methodFilter === "other" || search ? items.length : totalCount;
  const effectivePages =
    methodFilter === "other" || search
      ? totalPagesFromCount(effectiveTotal, pageSize)
      : totalPages;

  return {
    items,
    page,
    pageSize,
    totalCount: methodFilter === "other" || search ? effectiveTotal : totalCount,
    totalPages: effectivePages,
  };
}

export async function listPosTodayReceipts(
  supabase: SupabaseClient,
  restaurantId: string,
): Promise<PosReceiptListItem[]> {
  const { ymd } = await posRestaurantTodayYmd(restaurantId);
  const result = await listPosReceiptsInRange(
    supabase,
    restaurantId,
    ymd,
    ymd,
    { page: 1, pageSize: 100 },
  );
  return result.items;
}

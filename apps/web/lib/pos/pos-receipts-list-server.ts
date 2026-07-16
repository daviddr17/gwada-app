import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
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

/** Quittungen / Zahlungen in einem Kalendertag-Bereich (Restaurant-TZ). */
export async function listPosReceiptsInRange(
  supabase: SupabaseClient,
  restaurantId: string,
  fromYmd: string,
  toYmd: string,
): Promise<PosReceiptListItem[]> {
  const bounds = await posRestaurantYmdRangeBounds(
    restaurantId,
    fromYmd,
    toYmd,
  );
  if (!bounds) return [];

  const { data: payments, error } = await supabase
    .from("pos_payments")
    .select(
      "id, order_id, method, status, amount_cents, tip_cents, received_amount_cents, paid_at",
    )
    .eq("restaurant_id", restaurantId)
    .in("status", ["paid", "refunded"])
    .gte("paid_at", bounds.startAt)
    .lt("paid_at", bounds.endAt)
    .order("paid_at", { ascending: false })
    .limit(500);

  if (error || !payments?.length) {
    if (error) console.warn("[pos] receipts range", error.message);
    return [];
  }

  const orderIds = [...new Set(payments.map((p) => p.order_id as string))];
  const paymentIds = payments.map((p) => p.id as string);

  const { data: orders } = await supabase
    .from("pos_orders")
    .select("id, order_number, table_session_id, receipt_url")
    .in("id", orderIds);

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
    : { data: [] as { id: string; dining_table_id: string; status: string }[] };

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

  return Promise.all(
    payments.map(async (p) => {
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
}

export async function listPosTodayReceipts(
  supabase: SupabaseClient,
  restaurantId: string,
): Promise<PosReceiptListItem[]> {
  const { ymd } = await posRestaurantTodayYmd(restaurantId);
  return listPosReceiptsInRange(supabase, restaurantId, ymd, ymd);
}

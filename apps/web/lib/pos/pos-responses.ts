import "server-only";

import { derivePosPaymentState, type PosOrderStatus } from "@gwada/pos-domain";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolvePosReceiptSignedUrl } from "@/lib/pos/receipt-storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const POS_JSON_HEADERS = {
  "Cache-Control": "no-store",
} as const;

export function posJson(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, {
    ...init,
    headers: { ...POS_JSON_HEADERS, ...init?.headers },
  });
}

export function posError(
  error: string,
  status: number,
  extra?: Record<string, unknown>,
): Response {
  return posJson({ error, ...extra }, { status });
}

type OrderRow = {
  id: string;
  restaurant_id: string;
  table_session_id: string;
  order_number: number;
  status: PosOrderStatus;
  currency: string;
  subtotal_cents: number;
  discount_cents: number;
  tip_cents: number;
  total_cents: number;
  notes: string | null;
  fiskaly_failed_at: string | null;
  receipt_url: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

type LineRow = {
  id: string;
  menu_item_id: string | null;
  name: string;
  quantity: number;
  unit_price_cents: number;
  vat_rate: number;
  line_total_cents: number;
  notes: string | null;
  position: number;
};

type PaymentRow = {
  id: string;
  amount_cents: number;
  tip_cents: number;
  received_amount_cents: number | null;
  method: string;
  status: string;
  mollie_payment_id: string | null;
  paid_at: string | null;
};

type FiscalRow = {
  tx_id: string;
  signature: string;
  signature_counter: number;
  signed_at: string | null;
  receipt_public_url: string | null;
  custom_receipt_url: string | null;
};

export type PosOrderDto = {
  id: string;
  restaurantId: string;
  tableSessionId: string;
  orderNumber: number;
  status: PosOrderStatus;
  currency: string;
  subtotalCents: number;
  discountCents: number;
  tipCents: number;
  totalCents: number;
  notes: string | null;
  paymentState: ReturnType<typeof derivePosPaymentState>;
  fiskalyFailedAt: string | null;
  receiptUrl: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lines: Array<{
    id: string;
    menuItemId: string | null;
    name: string;
    quantity: number;
    unitPriceCents: number;
    vatRate: number;
    lineTotalCents: number;
    notes: string | null;
    position: number;
  }>;
  payments: Array<{
    id: string;
    amountCents: number;
    tipCents: number;
    receivedAmountCents: number | null;
    method: string;
    status: string;
    molliePaymentId: string | null;
    paidAt: string | null;
  }>;
  fiscal: {
    txId: string;
    signature: string;
    signatureCounter: number;
    signedAt: string | null;
    receiptPublicUrl: string | null;
  } | null;
};

function mapOrderDto(
  order: OrderRow,
  lines: LineRow[],
  payments: PaymentRow[],
  fiscal: FiscalRow | null,
): PosOrderDto {
  const paidTotal = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + Number(p.amount_cents), 0);

  return {
    id: order.id,
    restaurantId: order.restaurant_id,
    tableSessionId: order.table_session_id,
    orderNumber: order.order_number,
    status: order.status,
    currency: order.currency,
    subtotalCents: Number(order.subtotal_cents),
    discountCents: Number(order.discount_cents),
    tipCents: Number(order.tip_cents),
    totalCents: Number(order.total_cents),
    notes: order.notes,
    paymentState: derivePosPaymentState(Number(order.total_cents), paidTotal),
    fiskalyFailedAt: order.fiskaly_failed_at,
    receiptUrl: order.receipt_url,
    closedAt: order.closed_at,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    lines: lines.map((line) => ({
      id: line.id,
      menuItemId: line.menu_item_id,
      name: line.name,
      quantity: Number(line.quantity),
      unitPriceCents: Number(line.unit_price_cents),
      vatRate: Number(line.vat_rate),
      lineTotalCents: Number(line.line_total_cents),
      notes: line.notes,
      position: line.position,
    })),
    payments: payments.map((payment) => ({
      id: payment.id,
      amountCents: Number(payment.amount_cents),
      tipCents: Number(payment.tip_cents),
      receivedAmountCents:
        payment.received_amount_cents == null
          ? null
          : Number(payment.received_amount_cents),
      method: payment.method,
      status: payment.status,
      molliePaymentId: payment.mollie_payment_id,
      paidAt: payment.paid_at,
    })),
    fiscal: fiscal
      ? {
          txId: fiscal.tx_id,
          signature: fiscal.signature,
          signatureCounter: fiscal.signature_counter,
          signedAt: fiscal.signed_at,
          receiptPublicUrl: fiscal.receipt_public_url,
        }
      : null,
  };
}

export async function loadPosOrderDto(
  supabase: SupabaseClient,
  orderId: string,
): Promise<PosOrderDto | null> {
  const { data: order, error: orderError } = await supabase
    .from("pos_orders")
    .select(
      "id, restaurant_id, table_session_id, order_number, status, currency, subtotal_cents, discount_cents, tip_cents, total_cents, notes, fiskaly_failed_at, receipt_url, closed_at, created_at, updated_at",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) return null;

  const [{ data: lines }, { data: payments }, { data: fiscal }] =
    await Promise.all([
      supabase
        .from("pos_order_lines")
        .select(
          "id, menu_item_id, name, quantity, unit_price_cents, vat_rate, line_total_cents, notes, position",
        )
        .eq("order_id", orderId)
        .order("position"),
      supabase
        .from("pos_payments")
        .select(
          "id, amount_cents, tip_cents, received_amount_cents, method, status, mollie_payment_id, paid_at",
        )
        .eq("order_id", orderId)
        .order("created_at"),
      supabase
        .from("pos_fiscal_transactions")
        .select(
          "tx_id, signature, signature_counter, signed_at, receipt_public_url, custom_receipt_url",
        )
        .eq("order_id", orderId)
        .is("split_group", null)
        .maybeSingle(),
    ]);

  const dto = mapOrderDto(
    order as OrderRow,
    (lines ?? []) as LineRow[],
    (payments ?? []) as PaymentRow[],
    (fiscal as FiscalRow | null) ?? null,
  );

  let storagePath =
    order.receipt_url ??
    (fiscal as FiscalRow | null)?.custom_receipt_url ??
    null;

  if (
    !storagePath?.trim() &&
    order.status === "delivered" &&
    dto.paymentState === "paid"
  ) {
    const { tryGeneratePosReceipt } = await import("@/lib/pos/generate-pos-receipt");
    const generated = await tryGeneratePosReceipt(orderId, { force: true });
    if (generated.ok) {
      storagePath = generated.storagePath;
    }
  }

  const signedReceiptUrl = await resolvePosReceiptSignedUrl(storagePath);

  return {
    ...dto,
    receiptUrl: signedReceiptUrl,
  };
}

export async function loadPosOrdersForSession(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<PosOrderDto[]> {
  const { data: orders, error } = await supabase
    .from("pos_orders")
    .select("id")
    .eq("table_session_id", sessionId)
    .order("created_at", { ascending: false });

  if (error || !orders?.length) return [];

  const dtos = await Promise.all(
    orders.map((row) => loadPosOrderDto(supabase, row.id as string)),
  );
  return dtos.filter((dto): dto is PosOrderDto => dto != null);
}

export async function loadActivePosOrders(
  supabase: SupabaseClient,
  restaurantId: string,
): Promise<PosOrderDto[]> {
  const { data: orders, error } = await supabase
    .from("pos_orders")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .not("status", "in", '("delivered","cancelled")')
    .order("created_at", { ascending: false });

  if (error || !orders?.length) return [];

  const dtos = await Promise.all(
    orders.map((row) => loadPosOrderDto(supabase, row.id as string)),
  );
  return dtos.filter((dto): dto is PosOrderDto => dto != null);
}

async function loadPaidTodayOrderIds(
  supabase: SupabaseClient,
  restaurantId: string,
): Promise<string[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];

  const { data: bounds, error: boundsError } = await admin.rpc(
    "pos_restaurant_today_bounds",
    { p_restaurant_id: restaurantId },
  );

  if (boundsError || !bounds?.[0]) {
    console.warn("[pos] today bounds", boundsError?.message);
    return [];
  }

  const row = bounds[0] as { start_at: string; end_at: string };
  const { data: orders, error } = await supabase
    .from("pos_orders")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("status", "delivered")
    .gte("closed_at", row.start_at)
    .lt("closed_at", row.end_at)
    .order("closed_at", { ascending: false });

  if (error || !orders?.length) return [];
  return orders.map((o) => o.id as string);
}

export async function loadPaidTodayPosOrders(
  supabase: SupabaseClient,
  restaurantId: string,
): Promise<PosOrderDto[]> {
  const orderIds = await loadPaidTodayOrderIds(supabase, restaurantId);
  if (!orderIds.length) return [];

  const dtos = await Promise.all(
    orderIds.map((id) => loadPosOrderDto(supabase, id)),
  );
  return dtos.filter((dto): dto is PosOrderDto => dto != null);
}

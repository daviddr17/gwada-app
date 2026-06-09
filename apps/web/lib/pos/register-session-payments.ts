import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type SessionPaymentRow = {
  id: string;
  order_id: string;
  method: string;
  amount_cents: number;
  split_group: string | null;
};

export type SessionPaymentContext = {
  payments: SessionPaymentRow[];
  paymentById: Map<string, SessionPaymentRow>;
  /** Payment method per order (direct payment or via line allocation). */
  methodByOrderId: Map<string, string>;
};

export type SessionPaymentMethodTotals = {
  cashCents: number;
  nonCashCents: number;
  paymentTypeTotals: Array<{ type: string; amountCents: number }>;
};

export function sumSessionPaymentsByMethod(
  payments: SessionPaymentRow[],
): SessionPaymentMethodTotals {
  let cashCents = 0;
  let nonCashCents = 0;

  for (const payment of payments) {
    const amount = Number(payment.amount_cents ?? 0);
    if (payment.method === "cash") {
      cashCents += amount;
    } else {
      nonCashCents += amount;
    }
  }

  const paymentTypeTotals: Array<{ type: string; amountCents: number }> = [];
  if (cashCents > 0) {
    paymentTypeTotals.push({ type: "Bar", amountCents: cashCents });
  }
  if (nonCashCents > 0) {
    paymentTypeTotals.push({ type: "Unbar", amountCents: nonCashCents });
  }

  return { cashCents, nonCashCents, paymentTypeTotals };
}

/** Resolve payment method for a TSE row (split_group or order + allocations). */
export function resolveFiscalTransactionPaymentMethod(
  ctx: SessionPaymentContext,
  fiscal: { order_id: string; split_group: string | null },
): string {
  if (fiscal.split_group) {
    const linked = ctx.paymentById.get(fiscal.split_group);
    if (linked) return linked.method;
  }

  const fromOrder = ctx.methodByOrderId.get(fiscal.order_id);
  if (fromOrder) return fromOrder;

  return "cash";
}

export async function loadSessionPaymentContext(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    sessionOpenedAt: string;
    sessionClosedAt?: string;
  },
): Promise<SessionPaymentContext> {
  let query = admin
    .from("pos_payments")
    .select("id, order_id, method, amount_cents, split_group")
    .eq("restaurant_id", params.restaurantId)
    .eq("status", "paid")
    .gte("paid_at", params.sessionOpenedAt);

  if (params.sessionClosedAt) {
    query = query.lte("paid_at", params.sessionClosedAt);
  }

  const { data: paymentRows } = await query;

  const payments: SessionPaymentRow[] = (paymentRows ?? []).map((row) => ({
    id: row.id as string,
    order_id: row.order_id as string,
    method: row.method as string,
    amount_cents: Number(row.amount_cents ?? 0),
    split_group: (row.split_group as string | null) ?? null,
  }));

  const paymentById = new Map<string, SessionPaymentRow>();
  const methodByOrderId = new Map<string, string>();

  for (const payment of payments) {
    paymentById.set(payment.id, payment);
    methodByOrderId.set(payment.order_id, payment.method);
  }

  const paymentIds = payments.map((p) => p.id);
  if (paymentIds.length > 0) {
    const { data: allocations } = await admin
      .from("pos_payment_line_allocations")
      .select("payment_id, pos_order_lines(order_id)")
      .in("payment_id", paymentIds);

    for (const row of allocations ?? []) {
      const nested = row.pos_order_lines as
        | { order_id?: string }
        | { order_id?: string }[]
        | null;
      const line = Array.isArray(nested) ? nested[0] : nested;
      const orderId = line?.order_id;
      if (!orderId) continue;

      const payment = paymentById.get(row.payment_id as string);
      if (payment) {
        methodByOrderId.set(orderId, payment.method);
      }
    }
  }

  return { payments, paymentById, methodByOrderId };
}

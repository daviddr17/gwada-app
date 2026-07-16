import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type SessionPaymentRow = {
  id: string;
  order_id: string;
  method: string;
  amount_cents: number;
  split_group: string | null;
  restaurant_payment_method_id: string | null;
  payment_method_label: string | null;
  payment_method_kind: string | null;
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
  /** Menschenlesbare Aufschlüsselung (Bar, Unbar, Gutschein, eigene Arten). */
  paymentTypeTotals: Array<{ type: string; amountCents: number }>;
};

function fallbackLabel(method: string): string {
  const m = method.trim().toLowerCase();
  if (m === "cash") return "Bar";
  if (m === "voucher") return "Gutschein";
  if (m === "card" || m === "terminal" || m === "paypal") return "Unbar";
  return method || "Sonstig";
}

export function sumSessionPaymentsByMethod(
  payments: SessionPaymentRow[],
): SessionPaymentMethodTotals {
  let cashCents = 0;
  let nonCashCents = 0;
  const byLabel = new Map<string, number>();

  for (const payment of payments) {
    const amount = Number(payment.amount_cents ?? 0);
    const isCash =
      payment.payment_method_kind === "cash" ||
      (!payment.payment_method_kind && payment.method === "cash");

    if (isCash) {
      cashCents += amount;
    } else {
      nonCashCents += amount;
    }

    const label =
      payment.payment_method_label?.trim() || fallbackLabel(payment.method);
    byLabel.set(label, (byLabel.get(label) ?? 0) + amount);
  }

  const paymentTypeTotals = [...byLabel.entries()]
    .filter(([, amountCents]) => amountCents > 0)
    .map(([type, amountCents]) => ({ type, amountCents }))
    .sort((a, b) => b.amountCents - a.amountCents || a.type.localeCompare(b.type));

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
    .select(
      "id, order_id, method, amount_cents, split_group, restaurant_payment_method_id, pos_restaurant_payment_methods(label, kind)",
    )
    .eq("restaurant_id", params.restaurantId)
    .eq("status", "paid")
    .gte("paid_at", params.sessionOpenedAt);

  if (params.sessionClosedAt) {
    query = query.lte("paid_at", params.sessionClosedAt);
  }

  const { data } = await query;

  const payments: SessionPaymentRow[] = (data ?? []).map((row) => {
    const nested = row.pos_restaurant_payment_methods as
      | { label?: string; kind?: string }
      | { label?: string; kind?: string }[]
      | null;
    const methodRow = Array.isArray(nested) ? nested[0] : nested;
    return {
      id: String(row.id),
      order_id: String(row.order_id),
      method: String(row.method ?? "cash"),
      amount_cents: Number(row.amount_cents ?? 0),
      split_group: (row.split_group as string | null) ?? null,
      restaurant_payment_method_id:
        (row.restaurant_payment_method_id as string | null) ?? null,
      payment_method_label: methodRow?.label ?? null,
      payment_method_kind: methodRow?.kind ?? null,
    };
  });

  const paymentById = new Map(payments.map((p) => [p.id, p]));
  const methodByOrderId = new Map<string, string>();
  for (const p of payments) {
    if (!methodByOrderId.has(p.order_id)) {
      methodByOrderId.set(p.order_id, p.method);
    }
  }

  // Allocations → Order-Methode nachziehen
  const paymentIds = payments.map((p) => p.id);
  if (paymentIds.length > 0) {
    const { data: allocs } = await admin
      .from("pos_payment_line_allocations")
      .select("payment_id, pos_order_lines(order_id)")
      .in("payment_id", paymentIds);

    for (const alloc of allocs ?? []) {
      const payment = paymentById.get(String(alloc.payment_id));
      if (!payment) continue;
      const lineJoin = alloc.pos_order_lines as
        | { order_id?: string }
        | { order_id?: string }[]
        | null;
      const line = Array.isArray(lineJoin) ? lineJoin[0] : lineJoin;
      const orderId = line?.order_id;
      if (orderId && !methodByOrderId.has(orderId)) {
        methodByOrderId.set(orderId, payment.method);
      }
    }
  }

  return { payments, paymentById, methodByOrderId };
}

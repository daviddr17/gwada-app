import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type RegisterSessionRow = {
  id: string;
  restaurant_id: string;
  opened_at: string;
  closed_at: string | null;
  opening_cash_cents: number;
  closing_cash_cents: number | null;
  expected_cash_cents: number | null;
  cash_difference_cents: number | null;
  z_nr: number | null;
  cash_point_closing_id: string | null;
};

export type RegisterSessionAggregate = {
  sessionId: string;
  restaurantId: string;
  openedAt: string;
  closedAt: string | null;
  openingCashCents: number;
  closingCashCents: number | null;
  expectedCashCents: number | null;
  cashDifferenceCents: number | null;
  zNr: number | null;
  transactionCount: number;
  totalSalesCents: number;
  totalCashSalesCents: number;
  totalNonCashSalesCents: number;
  vatByRate: Array<{ rate: number; grossCents: number }>;
  paymentTypeTotals: Array<{ type: string; amountCents: number }>;
};

export async function getOpenRegisterSession(
  restaurantId: string,
): Promise<RegisterSessionRow | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const selectCols =
    "id, restaurant_id, opened_at, closed_at, opening_cash_cents, closing_cash_cents, expected_cash_cents, cash_difference_cents, z_nr, cash_point_closing_id";

  const { data } = await admin
    .from("pos_register_sessions")
    .select(selectCols)
    .eq("restaurant_id", restaurantId)
    .is("closed_at", null)
    .maybeSingle();

  if (data) return data as RegisterSessionRow;

  const { data: config } = await admin
    .from("pos_restaurant_fiscal_config")
    .select("register_opened_at")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  const legacyOpenedAt = config?.register_opened_at;
  if (!legacyOpenedAt) return null;

  const { data: backfill, error } = await admin
    .from("pos_register_sessions")
    .insert({
      restaurant_id: restaurantId,
      opened_at: legacyOpenedAt,
      opening_cash_cents: 0,
    })
    .select(selectCols)
    .single();

  if (error || !backfill) return null;

  await admin
    .from("pos_restaurant_fiscal_config")
    .update({ current_register_session_id: backfill.id })
    .eq("restaurant_id", restaurantId);

  return backfill as RegisterSessionRow;
}

export async function getRegisterSessionById(
  sessionId: string,
  restaurantId: string,
): Promise<RegisterSessionRow | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const { data } = await admin
    .from("pos_register_sessions")
    .select(
      "id, restaurant_id, opened_at, closed_at, opening_cash_cents, closing_cash_cents, expected_cash_cents, cash_difference_cents, z_nr, cash_point_closing_id",
    )
    .eq("id", sessionId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  return (data as RegisterSessionRow | null) ?? null;
}

export async function computeExpectedCashCents(params: {
  restaurantId: string;
  sessionOpenedAt: string;
  sessionClosedAt?: string;
  openingCashCents: number;
}): Promise<number> {
  const admin = createSupabaseAdminClient();
  if (!admin) return params.openingCashCents;

  let query = admin
    .from("pos_payments")
    .select("amount_cents")
    .eq("restaurant_id", params.restaurantId)
    .eq("method", "cash")
    .eq("status", "paid")
    .gte("paid_at", params.sessionOpenedAt);

  if (params.sessionClosedAt) {
    query = query.lte("paid_at", params.sessionClosedAt);
  }

  const { data: payments } = await query;

  let cashSalesCents = 0;
  for (const row of payments ?? []) {
    cashSalesCents += Number(row.amount_cents ?? 0);
  }

  return params.openingCashCents + cashSalesCents;
}

export async function loadRegisterSessionAggregate(
  session: RegisterSessionRow,
): Promise<RegisterSessionAggregate> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new Error("admin_unavailable");
  }

  const sessionEnd = session.closed_at ?? new Date().toISOString();

  const { data: fiscalRows } = await admin
    .from("pos_fiscal_transactions")
    .select("order_id, signed_at, pos_orders(total_cents, tip_cents)")
    .eq("restaurant_id", session.restaurant_id)
    .gte("signed_at", session.opened_at)
    .lte("signed_at", sessionEnd)
    .order("signed_at", { ascending: true });

  const orderIds = (fiscalRows ?? []).map((r) => r.order_id as string);

  const [{ data: lines }, { data: payments }] = await Promise.all([
    orderIds.length > 0
      ? admin
          .from("pos_order_lines")
          .select("order_id, line_total_cents, vat_rate")
          .in("order_id", orderIds)
      : Promise.resolve({ data: [] }),
    orderIds.length > 0
      ? admin
          .from("pos_payments")
          .select("order_id, method, amount_cents")
          .in("order_id", orderIds)
          .eq("status", "paid")
      : Promise.resolve({ data: [] }),
  ]);

  const vatTotals = new Map<number, number>();
  for (const line of lines ?? []) {
    const rate = Number(line.vat_rate);
    const cents = Number(line.line_total_cents);
    vatTotals.set(rate, (vatTotals.get(rate) ?? 0) + cents);
  }

  const paymentTypeTotals = new Map<string, number>();
  let totalCashSalesCents = 0;
  let totalSalesCents = 0;

  for (const row of fiscalRows ?? []) {
    const orderJoin = row.pos_orders as
      | { total_cents?: number; tip_cents?: number }
      | { total_cents?: number; tip_cents?: number }[]
      | null;
    const order = Array.isArray(orderJoin) ? orderJoin[0] : orderJoin;
    if (!order) continue;

    const grossCents = Number(order.total_cents ?? 0) + Number(order.tip_cents ?? 0);
    totalSalesCents += grossCents;
  }

  const paymentByOrder = new Map<string, { method: string; amount_cents: number }>();
  for (const payment of payments ?? []) {
    paymentByOrder.set(payment.order_id as string, {
      method: payment.method as string,
      amount_cents: Number(payment.amount_cents),
    });
  }

  for (const row of fiscalRows ?? []) {
    const payment = paymentByOrder.get(row.order_id as string);
    const orderJoin = row.pos_orders as
      | { total_cents?: number; tip_cents?: number }
      | { total_cents?: number; tip_cents?: number }[]
      | null;
    const order = Array.isArray(orderJoin) ? orderJoin[0] : orderJoin;
    if (!order) continue;

    const grossCents = Number(order.total_cents ?? 0) + Number(order.tip_cents ?? 0);
    const isCash = payment?.method === "cash";
    const type = isCash ? "Bar" : "Unbar";
    paymentTypeTotals.set(type, (paymentTypeTotals.get(type) ?? 0) + grossCents);
    if (isCash) totalCashSalesCents += grossCents;
  }

  const expectedCashCents =
    session.expected_cash_cents ??
    (await computeExpectedCashCents({
      restaurantId: session.restaurant_id,
      sessionOpenedAt: session.opened_at,
      sessionClosedAt: session.closed_at ?? undefined,
      openingCashCents: Number(session.opening_cash_cents),
    }));

  return {
    sessionId: session.id,
    restaurantId: session.restaurant_id,
    openedAt: session.opened_at,
    closedAt: session.closed_at,
    openingCashCents: Number(session.opening_cash_cents),
    closingCashCents:
      session.closing_cash_cents == null
        ? null
        : Number(session.closing_cash_cents),
    expectedCashCents,
    cashDifferenceCents:
      session.cash_difference_cents == null
        ? null
        : Number(session.cash_difference_cents),
    zNr: session.z_nr == null ? null : Number(session.z_nr),
    transactionCount: fiscalRows?.length ?? 0,
    totalSalesCents,
    totalCashSalesCents,
    totalNonCashSalesCents: totalSalesCents - totalCashSalesCents,
    vatByRate: Array.from(vatTotals.entries())
      .map(([rate, grossCents]) => ({ rate, grossCents }))
      .sort((a, b) => b.rate - a.rate),
    paymentTypeTotals: Array.from(paymentTypeTotals.entries()).map(
      ([type, amountCents]) => ({ type, amountCents }),
    ),
  };
}

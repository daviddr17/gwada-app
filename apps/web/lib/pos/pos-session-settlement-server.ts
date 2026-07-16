import "server-only";

import {
  allocationAmountCents,
  canReleaseTableSession,
  deriveLinePaymentState,
  deriveSessionSettlementState,
  openLineQuantity,
  type PosLinePaymentState,
} from "@gwada/pos-domain";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runPosPaymentPipelineForPayment } from "@/lib/pos/pos-payment-pipeline";
import { applyGiftVoucherRedemption } from "@/lib/pos/pos-gift-vouchers-server";
import { getOpenRegisterSession } from "@/lib/pos/register-report-aggregate";
import { tryGeneratePosPaymentReceipt } from "@/lib/pos/generate-pos-receipt";
import { resolvePosReceiptSignedUrl } from "@/lib/pos/receipt-storage";

export type SessionSummaryLine = {
  id: string;
  orderId: string;
  orderNumber: number;
  menuItemId: string | null;
  name: string;
  quantity: number;
  paidQuantity: number;
  openQuantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  openAmountCents: number;
  vatRate: number;
  linePaymentState: PosLinePaymentState;
  notes: string | null;
  position: number;
  course: string;
  modifiers: unknown[];
  ohneIngredientIds: string[];
};

export type SessionSummaryOrder = {
  id: string;
  orderNumber: number;
  status: string;
  totalCents: number;
  lines: SessionSummaryLine[];
};

export type SessionSummaryPaymentAllocation = {
  orderLineId: string;
  orderNumber: number;
  name: string;
  quantity: number;
  amountCents: number;
};

export type SessionSummaryPayment = {
  id: string;
  orderId: string;
  orderNumber: number;
  method: string;
  amountCents: number;
  tipCents: number;
  paidAt: string | null;
  receiptUrl: string | null;
  allocations: SessionSummaryPaymentAllocation[];
};

export type PosSessionSummaryDto = {
  sessionId: string;
  restaurantId: string;
  diningTableId: string;
  coverCount: number;
  status: string;
  isFullyPaid: boolean;
  openedAt: string;
  canReleaseTable: boolean;
  openCents: number;
  openLineCount: number;
  totalCents: number;
  paidCents: number;
  orders: SessionSummaryOrder[];
  payments: SessionSummaryPayment[];
};

export type CollectAllocationInput = {
  orderLineId: string;
  quantity: number;
};

async function loadSessionLines(
  supabase: SupabaseClient,
  sessionId: string,
  restaurantId: string,
): Promise<
  | {
      ok: true;
      lines: Array<{
        id: string;
        order_id: string;
        order_number: number;
        menu_item_id: string | null;
        name: string;
        quantity: number;
        paid_quantity: number;
        unit_price_cents: number;
        line_total_cents: number;
        vat_rate: number;
        notes: string | null;
        position: number;
        course?: string | null;
        modifiers?: unknown;
        ohne_ingredient_ids?: string[] | null;
      }>;
    }
  | { ok: false; error: string; status: number }
> {
  const { data: orders, error: ordersError } = await supabase
    .from("pos_orders")
    .select("id, order_number")
    .eq("table_session_id", sessionId)
    .eq("restaurant_id", restaurantId)
    .neq("status", "cancelled");

  if (ordersError) {
    return { ok: false, error: ordersError.message, status: 500 };
  }

  const orderIds = (orders ?? []).map((o) => o.id as string);
  if (orderIds.length === 0) {
    return { ok: true, lines: [] };
  }

  const orderNumberById = new Map(
    (orders ?? []).map((o) => [o.id as string, o.order_number as number]),
  );

  const { data: lineRows, error: linesError } = await supabase
    .from("pos_order_lines")
    .select(
      "id, order_id, menu_item_id, name, quantity, paid_quantity, unit_price_cents, line_total_cents, vat_rate, notes, position, course, modifiers, ohne_ingredient_ids",
    )
    .in("order_id", orderIds)
    .order("position");

  if (linesError) {
    return { ok: false, error: linesError.message, status: 500 };
  }

  return {
    ok: true,
    lines: (lineRows ?? []).map((row) => ({
      ...row,
      order_number: orderNumberById.get(row.order_id as string) ?? 0,
    })) as Array<{
      id: string;
      order_id: string;
      order_number: number;
      menu_item_id: string | null;
      name: string;
      quantity: number;
      paid_quantity: number;
      unit_price_cents: number;
      line_total_cents: number;
      vat_rate: number;
      notes: string | null;
      position: number;
      course?: string | null;
      modifiers?: unknown;
      ohne_ingredient_ids?: string[] | null;
    }>,
  };
}

function mapSummaryLine(row: {
  id: string;
  order_id: string;
  order_number: number;
  menu_item_id: string | null;
  name: string;
  quantity: number;
  paid_quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
  vat_rate: number;
  notes: string | null;
  position: number;
  course?: string | null;
  modifiers?: unknown;
  ohne_ingredient_ids?: string[] | null;
}): SessionSummaryLine {
  const quantity = Number(row.quantity);
  const paidQuantity = Number(row.paid_quantity ?? 0);
  const lineTotalCents = Number(row.line_total_cents);
  const openQty = openLineQuantity(quantity, paidQuantity);
  return {
    id: row.id,
    orderId: row.order_id,
    orderNumber: row.order_number,
    menuItemId: row.menu_item_id,
    name: row.name,
    quantity,
    paidQuantity,
    openQuantity: openQty,
    unitPriceCents: Number(row.unit_price_cents),
    lineTotalCents,
    openAmountCents: allocationAmountCents(lineTotalCents, quantity, openQty),
    vatRate: Number(row.vat_rate),
    linePaymentState: deriveLinePaymentState(quantity, paidQuantity),
    notes: row.notes,
    position: row.position,
    course: row.course ?? "other",
    modifiers: Array.isArray(row.modifiers) ? row.modifiers : [],
    ohneIngredientIds: Array.isArray(row.ohne_ingredient_ids)
      ? row.ohne_ingredient_ids
      : [],
  };
}

async function loadSessionPayments(
  supabase: SupabaseClient,
  sessionId: string,
  restaurantId: string,
): Promise<SessionSummaryPayment[]> {
  const { data: orders } = await supabase
    .from("pos_orders")
    .select("id, order_number")
    .eq("table_session_id", sessionId)
    .eq("restaurant_id", restaurantId)
    .neq("status", "cancelled");

  const orderIds = (orders ?? []).map((o) => o.id as string);
  if (orderIds.length === 0) return [];

  const orderNumberById = new Map(
    (orders ?? []).map((o) => [o.id as string, o.order_number as number]),
  );

  const { data: paymentRows } = await supabase
    .from("pos_payments")
    .select(
      "id, order_id, amount_cents, tip_cents, method, status, paid_at, created_at, split_group",
    )
    .in("order_id", orderIds)
    .eq("status", "paid")
    .order("paid_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (!paymentRows?.length) return [];

  const paymentIds = paymentRows.map((p) => p.id as string);
  const splitGroups = paymentRows
    .map((p) => (p.split_group as string | null) ?? (p.id as string))
    .filter(Boolean);

  const [{ data: allocationRows }, { data: fiscalRows }] = await Promise.all([
    supabase
      .from("pos_payment_line_allocations")
      .select(
        "payment_id, quantity, amount_cents, order_line_id, pos_order_lines(name, order_id)",
      )
      .in("payment_id", paymentIds),
    splitGroups.length > 0
      ? supabase
          .from("pos_fiscal_transactions")
          .select("split_group, custom_receipt_url, receipt_public_url")
          .in("split_group", splitGroups)
      : Promise.resolve({ data: [] as Array<{
          split_group: string | null;
          custom_receipt_url: string | null;
          receipt_public_url: string | null;
        }> }),
  ]);

  const fiscalBySplitGroup = new Map(
    (fiscalRows ?? []).map((f) => [f.split_group as string, f]),
  );

  const allocationsByPayment = new Map<
    string,
    SessionSummaryPaymentAllocation[]
  >();
  for (const row of allocationRows ?? []) {
    const paymentId = row.payment_id as string;
    const nested = row.pos_order_lines;
    const line = Array.isArray(nested) ? nested[0] : nested;
    const orderId = line?.order_id as string | undefined;
    const list = allocationsByPayment.get(paymentId) ?? [];
    list.push({
      orderLineId: row.order_line_id as string,
      orderNumber: orderId ? (orderNumberById.get(orderId) ?? 0) : 0,
      name: line?.name ?? "Position",
      quantity: Number(row.quantity),
      amountCents: Number(row.amount_cents),
    });
    allocationsByPayment.set(paymentId, list);
  }

  const payments: SessionSummaryPayment[] = [];

  for (const row of paymentRows) {
    const paymentId = row.id as string;
    const splitGroup =
      (row.split_group as string | null) ?? paymentId;
    const fiscal = fiscalBySplitGroup.get(splitGroup);

    let storagePath = fiscal?.custom_receipt_url?.trim() ?? null;
    if (!storagePath && allocationsByPayment.has(paymentId)) {
      const generated = await tryGeneratePosPaymentReceipt(paymentId);
      if (generated.ok) {
        storagePath = generated.storagePath;
      }
    }

    const signedUrl =
      (await resolvePosReceiptSignedUrl(storagePath)) ??
      fiscal?.receipt_public_url?.trim() ??
      null;

    payments.push({
      id: paymentId,
      orderId: row.order_id as string,
      orderNumber: orderNumberById.get(row.order_id as string) ?? 0,
      method: row.method as string,
      amountCents: Number(row.amount_cents),
      tipCents: Number(row.tip_cents),
      paidAt: (row.paid_at as string | null) ?? (row.created_at as string),
      receiptUrl: signedUrl,
      allocations: allocationsByPayment.get(paymentId) ?? [],
    });
  }

  return payments;
}

export async function loadPosSessionSummary(params: {
  supabase: SupabaseClient;
  restaurantId: string;
  sessionId: string;
}): Promise<
  | { ok: true; summary: PosSessionSummaryDto }
  | { ok: false; error: string; status: number }
> {
  const { data: session, error: sessionError } = await params.supabase
    .from("pos_table_sessions")
    .select(
      "id, restaurant_id, dining_table_id, cover_count, status, is_fully_paid, opened_at",
    )
    .eq("id", params.sessionId)
    .maybeSingle();

  if (sessionError || !session) {
    return { ok: false, error: "session_not_found", status: 404 };
  }

  if (session.restaurant_id !== params.restaurantId) {
    return { ok: false, error: "forbidden", status: 403 };
  }

  const linesResult = await loadSessionLines(
    params.supabase,
    params.sessionId,
    params.restaurantId,
  );
  if (!linesResult.ok) return linesResult;

  const summaryLines = linesResult.lines.map(mapSummaryLine);
  const settlement = deriveSessionSettlementState(
    summaryLines.map((l) => ({
      quantity: l.quantity,
      paidQuantity: l.paidQuantity,
      lineTotalCents: l.lineTotalCents,
    })),
  );

  const ordersMap = new Map<string, SessionSummaryOrder>();
  for (const line of summaryLines) {
    let order = ordersMap.get(line.orderId);
    if (!order) {
      order = {
        id: line.orderId,
        orderNumber: line.orderNumber,
        status: "received",
        totalCents: 0,
        lines: [],
      };
      ordersMap.set(line.orderId, order);
    }
    order.lines.push(line);
    order.totalCents += line.lineTotalCents;
  }

  const { data: orderStatuses } = await params.supabase
    .from("pos_orders")
    .select("id, status")
    .eq("table_session_id", params.sessionId);

  for (const row of orderStatuses ?? []) {
    const order = ordersMap.get(row.id as string);
    if (order) order.status = row.status as string;
  }

  const canReleaseTable =
    session.status === "open" &&
    canReleaseTableSession(
      summaryLines.map((l) => ({
        quantity: l.quantity,
        paidQuantity: l.paidQuantity,
        lineTotalCents: l.lineTotalCents,
      })),
    );

  const payments = await loadSessionPayments(
    params.supabase,
    params.sessionId,
    params.restaurantId,
  );

  return {
    ok: true,
    summary: {
      sessionId: session.id as string,
      restaurantId: session.restaurant_id as string,
      diningTableId: session.dining_table_id as string,
      coverCount: Number(session.cover_count),
      status: session.status as string,
      isFullyPaid: Boolean(session.is_fully_paid),
      openedAt: session.opened_at as string,
      canReleaseTable,
      openCents: settlement.openCents,
      openLineCount: settlement.openLineCount,
      totalCents: settlement.totalCents,
      paidCents: settlement.paidCents,
      orders: [...ordersMap.values()].sort(
        (a, b) => a.orderNumber - b.orderNumber,
      ),
      payments,
    },
  };
}

export async function recomputeSessionFullyPaid(
  admin: SupabaseClient,
  sessionId: string,
): Promise<void> {
  const { data: session } = await admin
    .from("pos_table_sessions")
    .select("id, restaurant_id, status")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session || session.status !== "open") return;

  const linesResult = await loadSessionLines(
    admin,
    sessionId,
    session.restaurant_id as string,
  );
  if (!linesResult.ok || linesResult.lines.length === 0) {
    await admin
      .from("pos_table_sessions")
      .update({ is_fully_paid: false })
      .eq("id", sessionId);
    return;
  }

  const settlement = deriveSessionSettlementState(
    linesResult.lines.map((l) => ({
      quantity: Number(l.quantity),
      paidQuantity: Number(l.paid_quantity ?? 0),
      lineTotalCents: Number(l.line_total_cents),
    })),
  );

  await admin
    .from("pos_table_sessions")
    .update({ is_fully_paid: settlement.allPaid })
    .eq("id", sessionId);
}

export async function collectCashAllocations(params: {
  supabase: SupabaseClient;
  restaurantId: string;
  tableSessionId: string;
  allocations: CollectAllocationInput[];
  tipCents?: number;
  receivedAmountCents?: number | null;
}): Promise<
  | { ok: true; paymentId: string }
  | { ok: false; error: string; status: number }
> {
  const register = await getOpenRegisterSession(params.restaurantId);
  if (!register) {
    return { ok: false, error: "register_closed", status: 403 };
  }

  const { data: session, error: sessionError } = await params.supabase
    .from("pos_table_sessions")
    .select("id, restaurant_id, status")
    .eq("id", params.tableSessionId)
    .maybeSingle();

  if (sessionError || !session) {
    return { ok: false, error: "session_not_found", status: 404 };
  }

  if (session.restaurant_id !== params.restaurantId) {
    return { ok: false, error: "forbidden", status: 403 };
  }

  if (session.status !== "open") {
    return { ok: false, error: "session_closed", status: 400 };
  }

  const normalized = params.allocations
    .map((a) => ({
      orderLineId: a.orderLineId.trim(),
      quantity: Number(a.quantity),
    }))
    .filter((a) => a.orderLineId && Number.isFinite(a.quantity) && a.quantity > 0);

  if (normalized.length === 0) {
    return { ok: false, error: "empty_allocations", status: 400 };
  }

  const linesResult = await loadSessionLines(
    params.supabase,
    params.tableSessionId,
    params.restaurantId,
  );
  if (!linesResult.ok) return linesResult;

  const lineById = new Map(linesResult.lines.map((l) => [l.id, l]));
  const merged = new Map<string, number>();
  for (const alloc of normalized) {
    merged.set(
      alloc.orderLineId,
      (merged.get(alloc.orderLineId) ?? 0) + alloc.quantity,
    );
  }

  let amountCents = 0;
  const resolved: Array<{
    orderLineId: string;
    quantity: number;
    amountCents: number;
    orderId: string;
  }> = [];

  for (const [orderLineId, qty] of merged) {
    const line = lineById.get(orderLineId);
    if (!line) {
      return { ok: false, error: "invalid_order_line", status: 400 };
    }
    const openQty = openLineQuantity(
      Number(line.quantity),
      Number(line.paid_quantity ?? 0),
    );
    if (qty > openQty + 1e-9) {
      return { ok: false, error: "allocation_exceeds_open_quantity", status: 400 };
    }
    const cents = allocationAmountCents(
      Number(line.line_total_cents),
      Number(line.quantity),
      qty,
    );
    amountCents += cents;
    resolved.push({
      orderLineId,
      quantity: qty,
      amountCents: cents,
      orderId: line.order_id,
    });
  }

  if (amountCents <= 0) {
    return { ok: false, error: "zero_amount", status: 400 };
  }

  const tipCents = Math.max(0, Math.round(params.tipCents ?? 0));
  const primaryOrderId = resolved[0]!.orderId;

  const { data: payment, error: payError } = await params.supabase
    .from("pos_payments")
    .insert({
      restaurant_id: params.restaurantId,
      order_id: primaryOrderId,
      amount_cents: amountCents + tipCents,
      tip_cents: tipCents,
      received_amount_cents: params.receivedAmountCents ?? null,
      method: "cash",
      status: "paid",
      paid_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (payError || !payment) {
    console.warn("[pos] collect allocations payment", payError?.message);
    return { ok: false, error: "payment_failed", status: 500 };
  }

  const paymentId = payment.id as string;

  await params.supabase
    .from("pos_payments")
    .update({ split_group: paymentId })
    .eq("id", paymentId);

  const { error: allocError } = await params.supabase
    .from("pos_payment_line_allocations")
    .insert(
      resolved.map((r) => ({
        payment_id: paymentId,
        order_line_id: r.orderLineId,
        quantity: r.quantity,
        amount_cents: r.amountCents,
      })),
    );

  if (allocError) {
    console.warn("[pos] collect allocations insert", allocError.message);
    await params.supabase.from("pos_payments").delete().eq("id", paymentId);
    return { ok: false, error: "allocation_failed", status: 500 };
  }

  for (const r of resolved) {
    const line = lineById.get(r.orderLineId)!;
    const nextPaid = Number(line.paid_quantity ?? 0) + r.quantity;
    const { error: lineError } = await params.supabase
      .from("pos_order_lines")
      .update({ paid_quantity: nextPaid })
      .eq("id", r.orderLineId);

    if (lineError) {
      console.warn("[pos] update paid_quantity", lineError.message);
      return { ok: false, error: "update_line_failed", status: 500 };
    }
  }

  const pipeline = await runPosPaymentPipelineForPayment(paymentId);
  if (!pipeline.ok) {
    return { ok: false, error: pipeline.error, status: 500 };
  }

  return { ok: true, paymentId };
}

/**
 * Teilzahlung mit Wertgutschein (Split möglich). Betrag ≤ offene Positionen und ≤ Guthaben.
 * MwSt entsteht über die Speisen-Positionen (TSE Unbar); Gutschein-Guthaben sinkt.
 */
export async function collectVoucherAllocations(params: {
  supabase: SupabaseClient;
  restaurantId: string;
  tableSessionId: string;
  allocations: CollectAllocationInput[];
  giftVoucherId: string;
  tipCents?: number;
  actorProfileId?: string | null;
}): Promise<
  | {
      ok: true;
      paymentId: string;
      remainingVoucherCents: number;
      voucherCode: string;
    }
  | { ok: false; error: string; status: number }
> {
  const register = await getOpenRegisterSession(params.restaurantId);
  if (!register) {
    return { ok: false, error: "register_closed", status: 403 };
  }

  const { data: session, error: sessionError } = await params.supabase
    .from("pos_table_sessions")
    .select("id, restaurant_id, status")
    .eq("id", params.tableSessionId)
    .maybeSingle();

  if (sessionError || !session) {
    return { ok: false, error: "session_not_found", status: 404 };
  }
  if (session.restaurant_id !== params.restaurantId) {
    return { ok: false, error: "forbidden", status: 403 };
  }
  if (session.status !== "open") {
    return { ok: false, error: "session_closed", status: 400 };
  }

  const normalized = params.allocations
    .map((a) => ({
      orderLineId: a.orderLineId.trim(),
      quantity: Number(a.quantity),
    }))
    .filter((a) => a.orderLineId && Number.isFinite(a.quantity) && a.quantity > 0);

  if (normalized.length === 0) {
    return { ok: false, error: "empty_allocations", status: 400 };
  }

  const linesResult = await loadSessionLines(
    params.supabase,
    params.tableSessionId,
    params.restaurantId,
  );
  if (!linesResult.ok) return linesResult;

  const lineById = new Map(linesResult.lines.map((l) => [l.id, l]));
  const merged = new Map<string, number>();
  for (const alloc of normalized) {
    merged.set(
      alloc.orderLineId,
      (merged.get(alloc.orderLineId) ?? 0) + alloc.quantity,
    );
  }

  let amountCents = 0;
  const resolved: Array<{
    orderLineId: string;
    quantity: number;
    amountCents: number;
    orderId: string;
  }> = [];

  for (const [orderLineId, qty] of merged) {
    const line = lineById.get(orderLineId);
    if (!line) {
      return { ok: false, error: "invalid_order_line", status: 400 };
    }
    const openQty = openLineQuantity(
      Number(line.quantity),
      Number(line.paid_quantity ?? 0),
    );
    if (qty > openQty + 1e-9) {
      return { ok: false, error: "allocation_exceeds_open_quantity", status: 400 };
    }
    const cents = allocationAmountCents(
      Number(line.line_total_cents),
      Number(line.quantity),
      qty,
    );
    amountCents += cents;
    resolved.push({
      orderLineId,
      quantity: qty,
      amountCents: cents,
      orderId: line.order_id,
    });
  }

  if (amountCents <= 0) {
    return { ok: false, error: "zero_amount", status: 400 };
  }

  const tipCents = Math.max(0, Math.round(params.tipCents ?? 0));
  const chargeCents = amountCents + tipCents;
  const primaryOrderId = resolved[0]!.orderId;

  const { data: payment, error: payError } = await params.supabase
    .from("pos_payments")
    .insert({
      restaurant_id: params.restaurantId,
      order_id: primaryOrderId,
      amount_cents: chargeCents,
      tip_cents: tipCents,
      method: "voucher",
      status: "paid",
      paid_at: new Date().toISOString(),
      gift_voucher_id: params.giftVoucherId,
    })
    .select("id")
    .single();

  if (payError || !payment) {
    console.warn("[pos] collect voucher payment", payError?.message);
    return { ok: false, error: "payment_failed", status: 500 };
  }

  const paymentId = payment.id as string;
  await params.supabase
    .from("pos_payments")
    .update({ split_group: paymentId })
    .eq("id", paymentId);

  const { error: allocError } = await params.supabase
    .from("pos_payment_line_allocations")
    .insert(
      resolved.map((r) => ({
        payment_id: paymentId,
        order_line_id: r.orderLineId,
        quantity: r.quantity,
        amount_cents: r.amountCents,
      })),
    );

  if (allocError) {
    console.warn("[pos] voucher allocations", allocError.message);
    await params.supabase.from("pos_payments").delete().eq("id", paymentId);
    return { ok: false, error: "allocation_failed", status: 500 };
  }

  const redeem = await applyGiftVoucherRedemption({
    supabase: params.supabase,
    restaurantId: params.restaurantId,
    voucherId: params.giftVoucherId,
    amountCents: chargeCents,
    paymentId,
    actorProfileId: params.actorProfileId,
  });

  if (!redeem.ok) {
    await params.supabase.from("pos_payments").delete().eq("id", paymentId);
    return redeem;
  }

  for (const r of resolved) {
    const line = lineById.get(r.orderLineId)!;
    const nextPaid = Number(line.paid_quantity ?? 0) + r.quantity;
    const { error: lineError } = await params.supabase
      .from("pos_order_lines")
      .update({ paid_quantity: nextPaid })
      .eq("id", r.orderLineId);

    if (lineError) {
      console.warn("[pos] voucher paid_quantity", lineError.message);
      return { ok: false, error: "update_line_failed", status: 500 };
    }
  }

  const pipeline = await runPosPaymentPipelineForPayment(paymentId);
  if (!pipeline.ok) {
    return { ok: false, error: pipeline.error, status: 500 };
  }

  return {
    ok: true,
    paymentId,
    remainingVoucherCents: redeem.remainingCents,
    voucherCode: redeem.voucher.code,
  };
}

export async function closePosTableSession(params: {
  supabase: SupabaseClient;
  restaurantId: string;
  sessionId: string;
}): Promise<
  | { ok: true; sessionId: string }
  | { ok: false; error: string; status: number }
> {
  const summaryResult = await loadPosSessionSummary({
    supabase: params.supabase,
    restaurantId: params.restaurantId,
    sessionId: params.sessionId,
  });

  if (!summaryResult.ok) return summaryResult;

  if (summaryResult.summary.status !== "open") {
    return { ok: false, error: "session_already_closed", status: 400 };
  }

  if (!summaryResult.summary.canReleaseTable) {
    return { ok: false, error: "session_has_open_lines", status: 403 };
  }

  const { error } = await params.supabase
    .from("pos_table_sessions")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
      is_fully_paid: true,
    })
    .eq("id", params.sessionId);

  if (error) {
    return { ok: false, error: "close_session_failed", status: 500 };
  }

  return { ok: true, sessionId: params.sessionId };
}

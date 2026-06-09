import "server-only";

import { derivePosPaymentState } from "@gwada/pos-domain";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  persistFiskalyTransaction,
  signPosOrderWithFiskaly,
} from "@/lib/pos/fiskaly-client";
import { tryCreateEReceiptForOrder } from "@/lib/pos/fiskaly-ereceipt";
import { ensureRegisterSessionOpen } from "@/lib/pos/fiskaly-register-session";
import { tryGeneratePosPaymentReceipt, tryGeneratePosReceipt } from "@/lib/pos/generate-pos-receipt";
import { recomputeSessionFullyPaid } from "@/lib/pos/pos-session-settlement-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type OrderRow = {
  id: string;
  restaurant_id: string;
  table_session_id: string;
  status: string;
  total_cents: number;
  tip_cents: number;
  fiskaly_failed_at: string | null;
};

type OrderLineRow = {
  id: string;
  quantity: number;
  paid_quantity: number;
};

type PaymentRow = {
  id: string;
  restaurant_id: string;
  order_id: string;
  amount_cents: number;
  tip_cents: number;
  method: string;
  status: string;
  split_group: string | null;
};

type AllocationRow = {
  quantity: number;
  amount_cents: number;
  pos_order_lines: {
    name: string;
    vat_rate: number;
  } | {
    name: string;
    vat_rate: number;
  }[] | null;
};

async function isOrderFullyPaidByLines(
  admin: SupabaseClient,
  orderId: string,
): Promise<boolean> {
  const { data: lines } = await admin
    .from("pos_order_lines")
    .select("quantity, paid_quantity")
    .eq("order_id", orderId);

  if (!lines?.length) return false;

  return lines.every(
    (l) => Number(l.paid_quantity ?? 0) >= Number(l.quantity) - 1e-9,
  );
}

async function finalizeOrderIfFullyPaid(
  admin: SupabaseClient,
  orderId: string,
): Promise<void> {
  const { data: order } = await admin
    .from("pos_orders")
    .select("id, status, table_session_id")
    .eq("id", orderId)
    .maybeSingle();

  if (!order || order.status === "delivered" || order.status === "cancelled") {
    return;
  }

  const fullyPaid = await isOrderFullyPaidByLines(admin, orderId);
  if (!fullyPaid) return;

  await tryGeneratePosReceipt(orderId, { force: true });

  await admin
    .from("pos_orders")
    .update({
      status: "delivered",
      closed_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  await recomputeSessionFullyPaid(admin, order.table_session_id as string);
}

/** After allocation-based cash payment: TSE sign payment, finalize affected orders. */
export async function runPosPaymentPipelineForPayment(
  paymentId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "admin_unavailable" };

  const { data: payment, error: payError } = await admin
    .from("pos_payments")
    .select(
      "id, restaurant_id, order_id, amount_cents, tip_cents, method, status, split_group",
    )
    .eq("id", paymentId)
    .maybeSingle();

  if (payError || !payment) {
    return { ok: false, error: "payment_not_found" };
  }

  if (payment.status !== "paid") {
    return { ok: false, error: "payment_not_paid" };
  }

  const { data: allocations, error: allocError } = await admin
    .from("pos_payment_line_allocations")
    .select(
      "quantity, amount_cents, pos_order_lines(name, vat_rate)",
    )
    .eq("payment_id", paymentId);

  if (allocError) {
    return { ok: false, error: allocError.message };
  }

  if (!allocations?.length) {
    return { ok: true };
  }

  const splitGroup = (payment.split_group as string | null) ?? paymentId;

  const { data: existingTx } = await admin
    .from("pos_fiscal_transactions")
    .select("id")
    .eq("split_group", splitGroup)
    .maybeSingle();

  if (!existingTx) {
    const lines = (allocations as AllocationRow[]).map((a) => {
      const nested = a.pos_order_lines;
      const row = Array.isArray(nested) ? nested[0] : nested;
      return {
        name: row?.name ?? "Position",
        lineTotalCents: Number(a.amount_cents),
        vatRate: Number(row?.vat_rate ?? 19),
      };
    });

    const baseCents = lines.reduce((s, l) => s + l.lineTotalCents, 0);
    const tipCents = Math.max(0, Number(payment.tip_cents));

    if (payment.method === "cash") {
      const registerOpen = await ensureRegisterSessionOpen(
        payment.restaurant_id as string,
      );
      if (!registerOpen.ok) {
        console.warn("[pos] Register open non-fatal failure", registerOpen.error);
      }
    }

    const signResult = await signPosOrderWithFiskaly({
      txId: paymentId,
      orderId: payment.order_id as string,
      restaurantId: payment.restaurant_id as string,
      totalCents: baseCents,
      tipCents,
      lines,
      paymentType: payment.method === "cash" ? "CASH" : "NON_CASH",
    });

    if (signResult.ok) {
      await persistFiskalyTransaction({
        restaurantId: payment.restaurant_id as string,
        orderId: payment.order_id as string,
        txId: signResult.txId,
        tssId: signResult.tssId,
        clientId: signResult.clientId,
        txRevision: signResult.txRevision,
        signature: signResult.signature,
        signatureCounter: signResult.signatureCounter,
        splitGroup,
      });
      await tryCreateEReceiptForOrder(payment.order_id as string);
    } else {
      console.warn("[pos] Fiskaly non-fatal failure", signResult.error);
      await admin
        .from("pos_orders")
        .update({ fiskaly_failed_at: new Date().toISOString() })
        .eq("id", payment.order_id as string);
    }
  }

  await tryGeneratePosPaymentReceipt(paymentId);

  const { data: allocationLineIds } = await admin
    .from("pos_payment_line_allocations")
    .select("order_line_id")
    .eq("payment_id", paymentId);

  const lineIds = (allocationLineIds ?? []).map((r) => r.order_line_id as string);
  const orderIds = new Set<string>([payment.order_id as string]);

  if (lineIds.length > 0) {
    const { data: lineOrders } = await admin
      .from("pos_order_lines")
      .select("order_id")
      .in("id", lineIds);
    for (const row of lineOrders ?? []) {
      orderIds.add(row.order_id as string);
    }
  }

  for (const orderId of orderIds) {
    await finalizeOrderIfFullyPaid(admin, orderId);
  }

  const { data: order } = await admin
    .from("pos_orders")
    .select("table_session_id")
    .eq("id", payment.order_id as string)
    .maybeSingle();

  if (order?.table_session_id) {
    await recomputeSessionFullyPaid(admin, order.table_session_id as string);
  }

  return { ok: true };
}

async function loadOrderContext(
  admin: SupabaseClient,
  orderId: string,
): Promise<
  | {
      ok: true;
      order: OrderRow;
      lines: Array<{ name: string; line_total_cents: number; vat_rate: number }>;
      payments: Array<{ method: string; status: string; amount_cents: number }>;
    }
  | { ok: false; error: string }
> {
  const { data: order, error: orderError } = await admin
    .from("pos_orders")
    .select(
      "id, restaurant_id, table_session_id, status, total_cents, tip_cents, fiskaly_failed_at",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    return { ok: false, error: "order_not_found" };
  }

  const { data: lines, error: linesError } = await admin
    .from("pos_order_lines")
    .select("name, line_total_cents, vat_rate")
    .eq("order_id", orderId)
    .order("position");

  if (linesError) {
    return { ok: false, error: linesError.message };
  }

  const { data: payments, error: paymentsError } = await admin
    .from("pos_payments")
    .select("method, status, amount_cents")
    .eq("order_id", orderId);

  if (paymentsError) {
    return { ok: false, error: paymentsError.message };
  }

  return {
    ok: true,
    order: order as OrderRow,
    lines: (lines ?? []) as Array<{
      name: string;
      line_total_cents: number;
      vat_rate: number;
    }>,
    payments: (payments ?? []) as Array<{
      method: string;
      status: string;
      amount_cents: number;
    }>,
  };
}

/** Legacy: full-order payment pipeline (delegates to line-based when allocations exist). */
export async function runPosPaymentPipeline(
  orderId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "admin_unavailable" };

  const { data: latestPayment } = await admin
    .from("pos_payments")
    .select("id")
    .eq("order_id", orderId)
    .eq("status", "paid")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestPayment) {
    const { data: alloc } = await admin
      .from("pos_payment_line_allocations")
      .select("id")
      .eq("payment_id", latestPayment.id as string)
      .limit(1)
      .maybeSingle();

    if (alloc) {
      return runPosPaymentPipelineForPayment(latestPayment.id as string);
    }
  }

  const ctx = await loadOrderContext(admin, orderId);
  if (!ctx.ok) return ctx;

  const { order, lines, payments } = ctx;

  if (order.status === "delivered" || order.status === "cancelled") {
    return { ok: true };
  }

  const paidTotal = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + Number(p.amount_cents), 0);

  const paymentState = derivePosPaymentState(
    Number(order.total_cents),
    paidTotal,
  );

  if (paymentState !== "paid") {
    return { ok: true };
  }

  const { data: lineRows } = await admin
    .from("pos_order_lines")
    .select("id, quantity, paid_quantity")
    .eq("order_id", orderId);

  for (const line of lineRows ?? []) {
    if (Number(line.paid_quantity ?? 0) < Number(line.quantity)) {
      await admin
        .from("pos_order_lines")
        .update({ paid_quantity: line.quantity })
        .eq("id", line.id as string);
    }
  }

  const { data: existingTx } = await admin
    .from("pos_fiscal_transactions")
    .select("id")
    .eq("order_id", orderId)
    .is("split_group", null)
    .maybeSingle();

  if (!existingTx) {
    const hasCash = payments.some(
      (p) => p.status === "paid" && p.method === "cash",
    );

    if (hasCash) {
      const registerOpen = await ensureRegisterSessionOpen(order.restaurant_id);
      if (!registerOpen.ok) {
        console.warn("[pos] Register open non-fatal failure", registerOpen.error);
      }
    }

    const signResult = await signPosOrderWithFiskaly({
      txId: order.id,
      orderId: order.id,
      restaurantId: order.restaurant_id,
      totalCents: Number(order.total_cents),
      tipCents: Number(order.tip_cents),
      lines: lines.map((line) => ({
        name: line.name,
        lineTotalCents: Number(line.line_total_cents),
        vatRate: Number(line.vat_rate),
      })),
      paymentType: hasCash ? "CASH" : "NON_CASH",
    });

    if (signResult.ok) {
      await persistFiskalyTransaction({
        restaurantId: order.restaurant_id,
        orderId: order.id,
        txId: signResult.txId,
        tssId: signResult.tssId,
        clientId: signResult.clientId,
        txRevision: signResult.txRevision,
        signature: signResult.signature,
        signatureCounter: signResult.signatureCounter,
      });
      await admin
        .from("pos_orders")
        .update({ fiskaly_failed_at: null })
        .eq("id", orderId);
      await tryCreateEReceiptForOrder(orderId);
    } else {
      console.warn("[pos] Fiskaly non-fatal failure", signResult.error);
      await admin
        .from("pos_orders")
        .update({ fiskaly_failed_at: new Date().toISOString() })
        .eq("id", orderId);
    }
  }

  await finalizeOrderIfFullyPaid(admin, orderId);

  return { ok: true };
}

export async function retryPosOrderFiskalySigning(
  orderId: string,
): Promise<
  | { ok: true; signed: boolean }
  | { ok: false; error: string; status?: number }
> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "admin_unavailable" };

  const ctx = await loadOrderContext(admin, orderId);
  if (!ctx.ok) return { ok: false, error: ctx.error, status: 404 };

  const { order, lines, payments } = ctx;
  const paidTotal = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + Number(p.amount_cents), 0);

  if (derivePosPaymentState(Number(order.total_cents), paidTotal) !== "paid") {
    return { ok: false, error: "order_not_fully_paid", status: 400 };
  }

  const hasCash = payments.some(
    (p) => p.status === "paid" && p.method === "cash",
  );

  if (hasCash) {
    const registerOpen = await ensureRegisterSessionOpen(order.restaurant_id);
    if (!registerOpen.ok) {
      console.warn("[pos] Register open non-fatal failure", registerOpen.error);
    }
  }

  const signResult = await signPosOrderWithFiskaly({
    txId: order.id,
    orderId: order.id,
    restaurantId: order.restaurant_id,
    totalCents: Number(order.total_cents),
    tipCents: Number(order.tip_cents),
    lines: lines.map((line) => ({
      name: line.name,
      lineTotalCents: Number(line.line_total_cents),
      vatRate: Number(line.vat_rate),
    })),
    paymentType: hasCash ? "CASH" : "NON_CASH",
  });

  if (!signResult.ok) {
    return { ok: false, error: signResult.error, status: 502 };
  }

  const persisted = await persistFiskalyTransaction({
    restaurantId: order.restaurant_id,
    orderId: order.id,
    txId: signResult.txId,
    tssId: signResult.tssId,
    clientId: signResult.clientId,
    txRevision: signResult.txRevision,
    signature: signResult.signature,
    signatureCounter: signResult.signatureCounter,
  });

  if (!persisted.ok) {
    return { ok: false, error: persisted.error, status: 500 };
  }

  await admin
    .from("pos_orders")
    .update({ fiskaly_failed_at: null })
    .eq("id", orderId);

  await tryCreateEReceiptForOrder(orderId);
  await tryGeneratePosReceipt(orderId, { force: true });

  return { ok: true, signed: true };
}

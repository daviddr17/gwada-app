import "server-only";

import { derivePosPaymentState } from "@gwada/pos-domain";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  persistFiskalyTransaction,
  signPosOrderWithFiskaly,
} from "@/lib/pos/fiskaly-client";
import { tryCreateEReceiptForOrder } from "@/lib/pos/fiskaly-ereceipt";
import { ensureRegisterSessionOpen } from "@/lib/pos/fiskaly-register-session";
import { tryGeneratePosReceipt } from "@/lib/pos/generate-pos-receipt";
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
  name: string;
  line_total_cents: number;
  vat_rate: number;
};

type PaymentRow = {
  method: string;
  status: string;
  amount_cents: number;
};

async function loadOrderContext(
  admin: SupabaseClient,
  orderId: string,
): Promise<
  | { ok: true; order: OrderRow; lines: OrderLineRow[]; payments: PaymentRow[] }
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
    lines: (lines ?? []) as OrderLineRow[],
    payments: (payments ?? []) as PaymentRow[],
  };
}

/** After payment: Fiskaly (non-fatal), then mark order delivered when fully paid. */
export async function runPosPaymentPipeline(
  orderId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "admin_unavailable" };

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

  await tryGeneratePosReceipt(orderId, { force: true });

  await admin
    .from("pos_orders")
    .update({
      status: "delivered",
      closed_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  await admin
    .from("pos_table_sessions")
    .update({ is_fully_paid: true })
    .eq("id", order.table_session_id);

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

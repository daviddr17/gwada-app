import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Bar-Zahlung stornieren: Allocations rückgängig, Payment → refunded,
 * optional Tisch-Session wieder öffnen.
 * Fiskaly/Geldfluss-Korrektur folgt separat.
 */
export async function voidCashPayment(params: {
  supabase: SupabaseClient;
  restaurantId: string;
  paymentId: string;
  reopenTable?: boolean;
  voidReasonId?: string | null;
  userId?: string | null;
}): Promise<
  | {
      ok: true;
      paymentId: string;
      tableSessionId: string;
      reopened: boolean;
      inventoryRestored: boolean;
    }
  | { ok: false; error: string; status: number }
> {
  const { data: payment, error: payError } = await params.supabase
    .from("pos_payments")
    .select(
      "id, restaurant_id, order_id, method, status, amount_cents, tip_cents",
    )
    .eq("id", params.paymentId)
    .maybeSingle();

  if (payError || !payment) {
    return { ok: false, error: "payment_not_found", status: 404 };
  }
  if (payment.restaurant_id !== params.restaurantId) {
    return { ok: false, error: "forbidden", status: 403 };
  }
  if (payment.method !== "cash") {
    return { ok: false, error: "not_cash_payment", status: 400 };
  }
  if (payment.status !== "paid") {
    return { ok: false, error: "payment_not_paid", status: 400 };
  }

  const voidReasonId = params.voidReasonId?.trim() || null;
  if (voidReasonId) {
    const { data: reason } = await params.supabase
      .from("pos_void_reasons")
      .select("id, is_active")
      .eq("id", voidReasonId)
      .eq("restaurant_id", params.restaurantId)
      .maybeSingle();
    if (!reason || reason.is_active === false) {
      return { ok: false, error: "invalid_void_reason", status: 400 };
    }
  } else {
    const { count } = await params.supabase
      .from("pos_void_reasons")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", params.restaurantId)
      .eq("is_active", true);
    if ((count ?? 0) > 0) {
      return { ok: false, error: "void_reason_required", status: 400 };
    }
  }

  const { data: order, error: orderError } = await params.supabase
    .from("pos_orders")
    .select("id, table_session_id, restaurant_id, status")
    .eq("id", payment.order_id)
    .maybeSingle();

  if (orderError || !order) {
    return { ok: false, error: "order_not_found", status: 404 };
  }

  const { data: allocations, error: allocError } = await params.supabase
    .from("pos_payment_line_allocations")
    .select("id, order_line_id, quantity")
    .eq("payment_id", params.paymentId);

  if (allocError) {
    return { ok: false, error: "allocations_load_failed", status: 500 };
  }

  for (const alloc of allocations ?? []) {
    const { data: line, error: lineError } = await params.supabase
      .from("pos_order_lines")
      .select("id, paid_quantity, quantity")
      .eq("id", alloc.order_line_id)
      .maybeSingle();
    if (lineError || !line) {
      return { ok: false, error: "line_not_found", status: 500 };
    }
    const nextPaid = Math.max(
      0,
      Number(line.paid_quantity ?? 0) - Number(alloc.quantity),
    );
    const { error: updError } = await params.supabase
      .from("pos_order_lines")
      .update({ paid_quantity: nextPaid })
      .eq("id", line.id);
    if (updError) {
      console.warn("[pos] void cash paid_quantity", updError.message);
      return { ok: false, error: "update_line_failed", status: 500 };
    }
  }

  const { error: delAllocError } = await params.supabase
    .from("pos_payment_line_allocations")
    .delete()
    .eq("payment_id", params.paymentId);
  if (delAllocError) {
    console.warn("[pos] void cash delete alloc", delAllocError.message);
    return { ok: false, error: "delete_allocations_failed", status: 500 };
  }

  const voidedAt = new Date().toISOString();
  const { error: refundError } = await params.supabase
    .from("pos_payments")
    .update({
      status: "refunded",
      void_reason_id: voidReasonId,
      voided_at: voidedAt,
      voided_by_profile_id: params.userId ?? null,
    })
    .eq("id", params.paymentId);
  if (refundError) {
    console.warn("[pos] void cash refund status", refundError.message);
    return { ok: false, error: "refund_update_failed", status: 500 };
  }

  let inventoryRestored = false;
  if (voidReasonId) {
    const { maybeRestoreInventoryForPosVoid } = await import(
      "@/lib/pos/pos-inventory-booking-server"
    );
    const restore = await maybeRestoreInventoryForPosVoid({
      supabase: params.supabase,
      restaurantId: params.restaurantId,
      orderId: order.id as string,
      paymentId: params.paymentId,
      voidReasonId,
      userId: params.userId ?? "",
    });
    if (restore.error) {
      console.warn("[pos] void inventory restore", restore.error);
    } else {
      inventoryRestored = restore.restored;
    }
  }

  // Order ggf. wieder in Küchen-Lifecycle, wenn schon delivered
  if (order.status === "delivered") {
    await params.supabase
      .from("pos_orders")
      .update({ status: "received", closed_at: null })
      .eq("id", order.id);
  }

  let reopened = false;
  const tableSessionId = order.table_session_id as string;

  if (params.reopenTable !== false) {
    const { data: session } = await params.supabase
      .from("pos_table_sessions")
      .select("id, dining_table_id, status")
      .eq("id", tableSessionId)
      .maybeSingle();

    if (session && session.status === "closed") {
      const { data: otherOpen } = await params.supabase
        .from("pos_table_sessions")
        .select("id")
        .eq("dining_table_id", session.dining_table_id)
        .eq("status", "open")
        .maybeSingle();

      if (!otherOpen) {
        const { error: reopenError } = await params.supabase
          .from("pos_table_sessions")
          .update({
            status: "open",
            closed_at: null,
            is_fully_paid: false,
          })
          .eq("id", session.id);
        if (!reopenError) reopened = true;
        else console.warn("[pos] void reopen session", reopenError.message);
      }
    } else if (session && session.status === "open") {
      await params.supabase
        .from("pos_table_sessions")
        .update({ is_fully_paid: false })
        .eq("id", session.id);
    }
  }

  return {
    ok: true,
    paymentId: params.paymentId,
    tableSessionId,
    reopened,
    inventoryRestored,
  };
}

export {
  listPosTodayReceipts,
  listPosReceiptsInRange,
  type PosReceiptListItem as PosTodayReceipt,
} from "@/lib/pos/pos-receipts-list-server";

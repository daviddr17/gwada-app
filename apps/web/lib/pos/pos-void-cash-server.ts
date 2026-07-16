import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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
}): Promise<
  | {
      ok: true;
      paymentId: string;
      tableSessionId: string;
      reopened: boolean;
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

  const { error: refundError } = await params.supabase
    .from("pos_payments")
    .update({ status: "refunded" })
    .eq("id", params.paymentId);
  if (refundError) {
    console.warn("[pos] void cash refund status", refundError.message);
    return { ok: false, error: "refund_update_failed", status: 500 };
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
  };
}

export type PosTodayReceipt = {
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
};

/** Heutige Bar-/Kartenzahlungen für Quittungs-Liste (Tisch + Storno-Flag). */
export async function listPosTodayReceipts(
  supabase: SupabaseClient,
  restaurantId: string,
): Promise<PosTodayReceipt[]> {
  const admin = createSupabaseAdminClient();
  let startAt: string;
  let endAt: string;
  if (admin) {
    const { data: bounds } = await admin.rpc("pos_restaurant_today_bounds", {
      p_restaurant_id: restaurantId,
    });
    const row = bounds?.[0] as { start_at?: string; end_at?: string } | undefined;
    if (row?.start_at && row?.end_at) {
      startAt = row.start_at;
      endAt = row.end_at;
    } else {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      startAt = start.toISOString();
      endAt = end.toISOString();
    }
  } else {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    startAt = start.toISOString();
    endAt = end.toISOString();
  }

  const { data: payments, error } = await supabase
    .from("pos_payments")
    .select(
      "id, order_id, method, status, amount_cents, tip_cents, received_amount_cents, paid_at",
    )
    .eq("restaurant_id", restaurantId)
    .in("status", ["paid", "refunded"])
    .gte("paid_at", startAt)
    .lt("paid_at", endAt)
    .order("paid_at", { ascending: false });

  if (error || !payments?.length) {
    if (error) console.warn("[pos] today receipts", error.message);
    return [];
  }

  const orderIds = [...new Set(payments.map((p) => p.order_id as string))];
  const { data: orders } = await supabase
    .from("pos_orders")
    .select("id, order_number, table_session_id")
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

  return payments.map((p) => {
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
    };
  });
}

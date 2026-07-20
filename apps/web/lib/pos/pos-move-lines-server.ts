import "server-only";

import { openLineQuantity } from "@gwada/pos-domain";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getOpenRegisterSession } from "@/lib/pos/register-report-aggregate";

/**
 * Unbezahlte Mengen von Positionen auf eine andere Tisch-Session umziehen.
 * Quelle: Mengen reduzieren / Zeile löschen; Ziel: neue Order mit kopierten Zeilen.
 */
export async function movePosOrderLines(params: {
  supabase: SupabaseClient;
  restaurantId: string;
  targetTableSessionId: string;
  lineMoves: Array<{ orderLineId: string; quantity: number }>;
  createdByProfileId: string | null;
}): Promise<
  | { ok: true; orderId: string; orderNumber: number }
  | { ok: false; error: string; status: number }
> {
  if (!params.lineMoves.length) {
    return { ok: false, error: "empty_move", status: 400 };
  }

  const registerSession = await getOpenRegisterSession(params.restaurantId);
  if (!registerSession) {
    return { ok: false, error: "register_closed", status: 403 };
  }

  const { data: targetSession, error: targetError } = await params.supabase
    .from("pos_table_sessions")
    .select("id, restaurant_id, status")
    .eq("id", params.targetTableSessionId)
    .maybeSingle();

  if (targetError || !targetSession) {
    return { ok: false, error: "target_session_not_found", status: 404 };
  }
  if (targetSession.restaurant_id !== params.restaurantId) {
    return { ok: false, error: "session_restaurant_mismatch", status: 400 };
  }
  if (targetSession.status !== "open") {
    return { ok: false, error: "target_session_closed", status: 400 };
  }

  const lineIds = params.lineMoves.map((m) => m.orderLineId);
  const { data: lines, error: linesError } = await params.supabase
    .from("pos_order_lines")
    .select(
      `
      id, order_id, menu_item_id, name, quantity, paid_quantity,
      unit_price_cents, vat_rate, notes, course, ohne_ingredient_ids, modifiers,
      pos_orders!inner ( id, restaurant_id, table_session_id, status )
    `,
    )
    .in("id", lineIds);

  if (linesError || !lines?.length) {
    return { ok: false, error: "lines_not_found", status: 404 };
  }

  type LineRow = {
    id: string;
    order_id: string;
    menu_item_id: string | null;
    name: string;
    quantity: number;
    paid_quantity: number | null;
    unit_price_cents: number;
    vat_rate: number;
    notes: string | null;
    course: string;
    ohne_ingredient_ids: string[] | null;
    modifiers: unknown;
    pos_orders: {
      id: string;
      restaurant_id: string;
      table_session_id: string;
      status: string;
    };
  };

  const typed = lines as unknown as LineRow[];
  const insertRows: Array<Record<string, unknown>> = [];
  let subtotalCents = 0;

  for (const move of params.lineMoves) {
    const line = typed.find((l) => l.id === move.orderLineId);
    if (!line) return { ok: false, error: "line_not_found", status: 404 };
    if (line.pos_orders.restaurant_id !== params.restaurantId) {
      return { ok: false, error: "forbidden", status: 403 };
    }
    if (line.pos_orders.table_session_id === params.targetTableSessionId) {
      return { ok: false, error: "same_session", status: 400 };
    }
    if (line.pos_orders.status === "cancelled") {
      return { ok: false, error: "order_cancelled", status: 400 };
    }

    const openQty = openLineQuantity(
      Number(line.quantity),
      Number(line.paid_quantity ?? 0),
    );
    const moveQty = move.quantity;
    if (!Number.isFinite(moveQty) || moveQty <= 0 || moveQty > openQty) {
      return { ok: false, error: "invalid_move_quantity", status: 400 };
    }

    const unit = Number(line.unit_price_cents);
    const lineTotal = Math.round(unit * moveQty);
    subtotalCents += lineTotal;

    insertRows.push({
      menu_item_id: line.menu_item_id,
      name: line.name,
      quantity: moveQty,
      unit_price_cents: unit,
      vat_rate: line.vat_rate,
      line_total_cents: lineTotal,
      notes: line.notes,
      course: line.course ?? "other",
      ohne_ingredient_ids: line.ohne_ingredient_ids ?? [],
      modifiers: line.modifiers ?? [],
      position: insertRows.length,
    });
  }

  const { data: order, error: orderError } = await params.supabase
    .from("pos_orders")
    .insert({
      restaurant_id: params.restaurantId,
      table_session_id: params.targetTableSessionId,
      status: "received",
      subtotal_cents: subtotalCents,
      total_cents: subtotalCents,
      notes: "Umgezogen",
      created_by_profile_id: params.createdByProfileId,
    })
    .select("id, order_number")
    .single();

  if (orderError || !order) {
    console.warn("[pos] move create order", orderError?.message);
    return { ok: false, error: "create_order_failed", status: 500 };
  }

  const { error: insertError } = await params.supabase
    .from("pos_order_lines")
    .insert(insertRows.map((row) => ({ ...row, order_id: order.id })));

  if (insertError) {
    await params.supabase.from("pos_orders").delete().eq("id", order.id);
    console.warn("[pos] move insert lines", insertError.message);
    return { ok: false, error: "create_order_lines_failed", status: 500 };
  }

  for (const move of params.lineMoves) {
    const line = typed.find((l) => l.id === move.orderLineId)!;
    const newQty = Number(line.quantity) - move.quantity;
    if (newQty <= 0) {
      await params.supabase.from("pos_order_lines").delete().eq("id", line.id);
    } else {
      await params.supabase
        .from("pos_order_lines")
        .update({
          quantity: newQty,
          line_total_cents: Math.round(Number(line.unit_price_cents) * newQty),
        })
        .eq("id", line.id);
    }

    // Quell-Order-Summen neu berechnen
    const { data: remaining } = await params.supabase
      .from("pos_order_lines")
      .select("line_total_cents")
      .eq("order_id", line.order_id);
    const total = (remaining ?? []).reduce(
      (s, r) => s + Number(r.line_total_cents),
      0,
    );
    if (!remaining?.length) {
      await params.supabase
        .from("pos_orders")
        .update({ status: "cancelled", subtotal_cents: 0, total_cents: 0 })
        .eq("id", line.order_id);
    } else {
      await params.supabase
        .from("pos_orders")
        .update({ subtotal_cents: total, total_cents: total })
        .eq("id", line.order_id);
    }
  }

  return {
    ok: true,
    orderId: order.id as string,
    orderNumber: order.order_number as number,
  };
}

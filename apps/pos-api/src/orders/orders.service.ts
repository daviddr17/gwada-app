import { Injectable } from "@nestjs/common";
import type { SupabaseClient } from "@supabase/supabase-js";
import { allocationAmountCents, openLineQuantity } from "@gwada/pos-domain";
import { SupabaseAdminService } from "../supabase-admin.service";
import { RegisterGateService } from "../sessions/sessions.service";

export type OrderLineInput = {
  menuItemId: string;
  quantity: number;
  course?: string;
  notes?: string;
  modifiers?: Array<{
    type?: string;
    label: string;
    priceDeltaCents?: number;
    optionChoiceId?: string;
  }>;
};

const COURSE_MAP: Record<string, string> = {
  "1": "starter",
  "2": "main",
  "3": "dessert",
  starter: "starter",
  main: "main",
  dessert: "dessert",
  side: "side",
  drink: "drink",
  other: "other",
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly supabaseAdmin: SupabaseAdminService,
    private readonly registerGate: RegisterGateService,
  ) {}

  private sb(): SupabaseClient {
    return this.supabaseAdmin.getClient();
  }

  async createOrder(params: {
    restaurantId: string;
    sessionId: string;
    profileId: string;
    items: OrderLineInput[];
    notes?: string;
  }) {
    if (!params.items?.length) {
      return { ok: false as const, error: "empty_order", status: 400 };
    }
    const register = await this.registerGate.requireOpenRegister(params.restaurantId);
    if (!register) return { ok: false as const, error: "register_closed", status: 403 };

    const sb = this.sb();
    const { data: session } = await sb
      .from("pos_table_sessions")
      .select("id, status, restaurant_id")
      .eq("id", params.sessionId)
      .eq("restaurant_id", params.restaurantId)
      .maybeSingle();
    if (!session) return { ok: false as const, error: "session_not_found", status: 404 };
    if (session.status !== "open" && session.status !== "bill") {
      return { ok: false as const, error: "session_not_orderable", status: 400 };
    }

    const menuIds = [...new Set(params.items.map((i) => i.menuItemId))];
    const { data: menuItems } = await sb
      .from("menu_items")
      .select("id, name, price, vat_rate, is_active, side_price_cents")
      .eq("restaurant_id", params.restaurantId)
      .in("id", menuIds);
    const menuById = new Map((menuItems ?? []).map((m) => [m.id as string, m]));

    let subtotal = 0;
    const lineRows: Record<string, unknown>[] = [];
    for (let i = 0; i < params.items.length; i++) {
      const input = params.items[i]!;
      const menu = menuById.get(input.menuItemId);
      if (!menu || !menu.is_active) {
        return { ok: false as const, error: "invalid_menu_item", status: 400 };
      }
      const qty = Number(input.quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        return { ok: false as const, error: "invalid_quantity", status: 400 };
      }
      const mods = Array.isArray(input.modifiers) ? input.modifiers : [];
      const delta = mods.reduce((s, m) => s + (Number(m.priceDeltaCents) || 0), 0);
      const unit = Math.round(Number(menu.price) * 100) + delta;
      const lineTotal = Math.round(unit * qty);
      subtotal += lineTotal;
      const courseKey = String(input.course ?? "other");
      const course = COURSE_MAP[courseKey] ?? "other";
      lineRows.push({
        menu_item_id: menu.id,
        name: menu.name,
        quantity: qty,
        unit_price_cents: unit,
        vat_rate: menu.vat_rate ?? 19,
        line_total_cents: lineTotal,
        notes: input.notes?.trim() || null,
        course,
        modifiers: mods,
        position: i,
        paid_quantity: 0,
      });
    }

    const { data: order, error: orderError } = await sb
      .from("pos_orders")
      .insert({
        restaurant_id: params.restaurantId,
        table_session_id: params.sessionId,
        status: "received",
        subtotal_cents: subtotal,
        total_cents: subtotal,
        notes: params.notes?.trim() || null,
        created_by_profile_id: params.profileId,
      })
      .select("id, order_number")
      .single();

    if (orderError || !order) {
      return {
        ok: false as const,
        error: orderError?.message ?? "create_order_failed",
        status: 500,
      };
    }

    const { error: linesError } = await sb
      .from("pos_order_lines")
      .insert(lineRows.map((row) => ({ ...row, order_id: order.id })));
    if (linesError) {
      await sb.from("pos_orders").delete().eq("id", order.id);
      return { ok: false as const, error: linesError.message, status: 500 };
    }

    return {
      ok: true as const,
      orderId: order.id as string,
      orderNumber: order.order_number as number,
    };
  }

  /** Mark unfired lines of a course as fired (Gang schicken). */
  async fireCourse(params: {
    restaurantId: string;
    sessionId: string;
    course: string;
  }) {
    const sb = this.sb();
    const course = COURSE_MAP[String(params.course)] ?? params.course;
    const { data: orders } = await sb
      .from("pos_orders")
      .select("id")
      .eq("table_session_id", params.sessionId)
      .eq("restaurant_id", params.restaurantId)
      .neq("status", "cancelled");
    const orderIds = (orders ?? []).map((o) => o.id as string);
    if (!orderIds.length) return { ok: true as const, firedLineIds: [] as string[] };

    const { data: lines } = await sb
      .from("pos_order_lines")
      .select("id, course, fired_at")
      .in("order_id", orderIds)
      .eq("course", course)
      .is("fired_at", null);

    const ids = (lines ?? []).map((l) => l.id as string);
    if (!ids.length) return { ok: true as const, firedLineIds: [] as string[] };

    const now = new Date().toISOString();
    const { error } = await sb
      .from("pos_order_lines")
      .update({ fired_at: now })
      .in("id", ids);
    if (error) return { ok: false as const, error: error.message, status: 500 };

    // Move orders toward preparing when anything fired
    await sb
      .from("pos_orders")
      .update({ status: "preparing" })
      .in("id", orderIds)
      .eq("status", "received");

    return { ok: true as const, firedLineIds: ids, firedAt: now };
  }
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly supabaseAdmin: SupabaseAdminService,
    private readonly registerGate: RegisterGateService,
  ) {}

  private sb(): SupabaseClient {
    return this.supabaseAdmin.getClient();
  }

  async collectCash(params: {
    restaurantId: string;
    sessionId: string;
    allocations: Array<{ orderLineId: string; quantity: number }>;
    tipCents?: number;
    receivedAmountCents?: number | null;
    settlementMode?: "item" | "amount";
  }) {
    const register = await this.registerGate.requireOpenRegister(params.restaurantId);
    if (!register) return { ok: false as const, error: "register_closed", status: 403 };

    const sb = this.sb();
    const { data: session } = await sb
      .from("pos_table_sessions")
      .select("id, status, settlement_mode, settled_cents, even_n")
      .eq("id", params.sessionId)
      .eq("restaurant_id", params.restaurantId)
      .maybeSingle();
    if (!session) return { ok: false as const, error: "session_not_found", status: 404 };
    if (!["open", "bill"].includes(session.status as string)) {
      return { ok: false as const, error: "session_closed", status: 400 };
    }

    const { data: orders } = await sb
      .from("pos_orders")
      .select("id")
      .eq("table_session_id", params.sessionId)
      .neq("status", "cancelled");
    const orderIds = (orders ?? []).map((o) => o.id as string);
    if (!orderIds.length) return { ok: false as const, error: "no_lines", status: 400 };

    const { data: lines } = await sb
      .from("pos_order_lines")
      .select("id, order_id, quantity, paid_quantity, line_total_cents, name, vat_rate")
      .in("order_id", orderIds);
    const lineById = new Map((lines ?? []).map((l) => [l.id as string, l]));

    const merged = new Map<string, number>();
    for (const a of params.allocations) {
      const id = a.orderLineId?.trim();
      const q = Number(a.quantity);
      if (!id || !Number.isFinite(q) || q <= 0) continue;
      merged.set(id, (merged.get(id) ?? 0) + q);
    }
    if (merged.size === 0) return { ok: false as const, error: "empty_allocations", status: 400 };

    let amountCents = 0;
    const resolved: Array<{
      orderLineId: string;
      quantity: number;
      amountCents: number;
      orderId: string;
      name: string;
      vatRate: number;
    }> = [];

    for (const [lineId, qty] of merged) {
      const line = lineById.get(lineId);
      if (!line) return { ok: false as const, error: "invalid_order_line", status: 400 };
      const openQty = openLineQuantity(Number(line.quantity), Number(line.paid_quantity ?? 0));
      if (qty > openQty + 1e-9) {
        return { ok: false as const, error: "allocation_exceeds_open", status: 400 };
      }
      const cents = allocationAmountCents(
        Number(line.line_total_cents),
        Number(line.quantity),
        qty,
      );
      amountCents += cents;
      resolved.push({
        orderLineId: lineId,
        quantity: qty,
        amountCents: cents,
        orderId: line.order_id as string,
        name: line.name as string,
        vatRate: Number(line.vat_rate ?? 19),
      });
    }

    const tipCents = Math.max(0, Math.round(params.tipCents ?? 0));
    const primaryOrderId = resolved[0]!.orderId;

    const { data: payment, error: payError } = await sb
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
      return { ok: false as const, error: payError?.message ?? "payment_failed", status: 500 };
    }

    const allocRows = resolved.map((r) => ({
      payment_id: payment.id,
      order_line_id: r.orderLineId,
      quantity: r.quantity,
      amount_cents: r.amountCents,
    }));
    const { error: allocError } = await sb.from("pos_payment_line_allocations").insert(allocRows);
    if (allocError) {
      return { ok: false as const, error: allocError.message, status: 500 };
    }

    for (const r of resolved) {
      const line = lineById.get(r.orderLineId)!;
      const nextPaid = Number(line.paid_quantity ?? 0) + r.quantity;
      await sb
        .from("pos_order_lines")
        .update({ paid_quantity: nextPaid })
        .eq("id", r.orderLineId);
    }

    // Settlement mode switch
    const mode =
      params.settlementMode === "amount" || session.settlement_mode === "amount"
        ? "amount"
        : "item";
    const settledExtra = mode === "amount" ? amountCents : 0;
    await sb
      .from("pos_table_sessions")
      .update({
        settlement_mode: mode,
        settled_cents: Number(session.settled_cents ?? 0) + settledExtra,
        status: "bill",
      })
      .eq("id", params.sessionId);

    const tse = await this.signPayment({
      restaurantId: params.restaurantId,
      paymentId: payment.id as string,
      orderId: primaryOrderId,
      amountCents: amountCents + tipCents,
      tipCents,
      method: "cash",
      lines: resolved.map((r) => ({
        name: r.name,
        lineTotalCents: r.amountCents,
        vatRate: r.vatRate,
      })),
    });

    // If everything paid → paid_pending_release
    const { data: refreshed } = await sb
      .from("pos_order_lines")
      .select("quantity, paid_quantity, line_total_cents")
      .in("order_id", orderIds);
    const allPaid = (refreshed ?? []).every(
      (l) => Number(l.paid_quantity ?? 0) >= Number(l.quantity) - 1e-9,
    );
    if (allPaid && (refreshed ?? []).length > 0) {
      await sb
        .from("pos_table_sessions")
        .update({ status: "paid_pending_release", is_fully_paid: true })
        .eq("id", params.sessionId);
      for (const oid of orderIds) {
        await sb
          .from("pos_orders")
          .update({ status: "delivered", closed_at: new Date().toISOString() })
          .eq("id", oid)
          .neq("status", "cancelled");
      }
    }

    return {
      ok: true as const,
      paymentId: payment.id as string,
      amountCents: amountCents + tipCents,
      tipCents,
      tse,
      fullyPaid: allPaid,
    };
  }

  async createMolliePayment(params: {
    restaurantId: string;
    sessionId: string;
    method: "card" | "paypal";
    amountCents: number;
    tipCents?: number;
    allocations: Array<{ orderLineId: string; quantity: number }>;
  }) {
    // Phase 2: create open payment row; real Mollie Checkout follows when API key configured.
    if (params.amountCents <= 0) {
      return { ok: false as const, error: "invalid_amount", status: 400 };
    }
    const cash = await this.collectCash({
      restaurantId: params.restaurantId,
      sessionId: params.sessionId,
      allocations: params.allocations,
      tipCents: params.tipCents,
      settlementMode: "amount",
    });
    // For now card/paypal go through same settlement path after "confirmation".
    // Return a checkout placeholder when Mollie not configured.
    if (!cash.ok) return cash;

    const sb = this.sb();
    await sb
      .from("pos_payments")
      .update({ method: params.method })
      .eq("id", cash.paymentId);

    const mollieKey = process.env.MOLLIE_API_KEY?.trim();
    return {
      ok: true as const,
      paymentId: cash.paymentId,
      method: params.method,
      checkoutUrl: mollieKey
        ? null
        : `pos-api://mollie-simulate/${cash.paymentId}`,
      simulated: !mollieKey,
      tse: cash.tse,
      fullyPaid: cash.fullyPaid,
    };
  }

  private async signPayment(input: {
    restaurantId: string;
    paymentId: string;
    orderId: string;
    amountCents: number;
    tipCents: number;
    method: string;
    lines: Array<{ name: string; lineTotalCents: number; vatRate: number }>;
  }) {
    const sb = this.sb();
    const mode = (process.env.FISKALY_MODE ?? "simulate").toLowerCase();
    const txId = cryptoRandom();
    const signature =
      mode === "simulate"
        ? `sim.${Buffer.from(`${input.paymentId}:${input.amountCents}`).toString("base64url")}`
        : `pending`; // real Fiskaly wired in later salvage module

    const { data: fiscalCols } = await sb
      .from("pos_fiscal_transactions")
      .insert({
        restaurant_id: input.restaurantId,
        order_id: input.orderId,
        split_group: input.paymentId,
        tss_id: mode === "simulate" ? "SIM-TSS" : "PENDING",
        client_id: mode === "simulate" ? "SIM-KASSE" : "PENDING",
        tx_id: txId,
        tx_revision: 1,
        signature,
        signature_counter: Math.floor(Date.now() / 1000) % 1_000_000,
        state: mode === "simulate" ? "FINISHED" : "ACTIVE",
        signed_at: new Date().toISOString(),
        is_retroactive: false,
      })
      .select("id")
      .maybeSingle();

    return {
      mode,
      txId,
      signature,
      paymentId: input.paymentId,
      fiscalRowId: fiscalCols?.id ?? null,
      receipt: {
        amountCents: input.amountCents,
        tipCents: input.tipCents,
        method: input.method,
        lines: input.lines,
        tse: {
          tx: txId,
          signature,
          algorithm: "ecdsa-plain-SHA256",
          timeFormat: "utcTime",
          serial: mode === "simulate" ? "SIM-TSS" : null,
          kasse: mode === "simulate" ? "SIM-KASSE" : null,
        },
      },
    };
  }
}

function cryptoRandom(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

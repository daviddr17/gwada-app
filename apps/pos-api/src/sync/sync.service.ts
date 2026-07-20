import { Injectable } from "@nestjs/common";
import { SupabaseAdminService } from "../supabase-admin.service";
import { SessionsService } from "../sessions/sessions.service";
import { OrdersService } from "../orders/orders.service";
import { PaymentsService } from "../orders/orders.service";

export type SyncEventInput = {
  eventId?: string;
  idempotencyKey: string;
  type: string;
  ts?: string;
  sessionId?: string | null;
  payload?: Record<string, unknown>;
};

@Injectable()
export class SyncService {
  constructor(
    private readonly supabaseAdmin: SupabaseAdminService,
    private readonly sessions: SessionsService,
    private readonly orders: OrdersService,
    private readonly payments: PaymentsService,
  ) {}

  async ingest(params: {
    restaurantId: string;
    profileId: string;
    deviceId: string | null;
    events: SyncEventInput[];
  }) {
    const sb = this.supabaseAdmin.getClient();
    const results: Array<{
      idempotencyKey: string;
      status: "applied" | "duplicate" | "rejected";
      result?: unknown;
      error?: string;
    }> = [];

    for (const ev of params.events) {
      const key = ev.idempotencyKey?.trim();
      if (!key || !ev.type) {
        results.push({
          idempotencyKey: key || "",
          status: "rejected",
          error: "invalid_event",
        });
        continue;
      }

      const { data: existing } = await sb
        .from("pos_sync_events")
        .select("id, result")
        .eq("restaurant_id", params.restaurantId)
        .eq("idempotency_key", key)
        .maybeSingle();

      if (existing) {
        results.push({
          idempotencyKey: key,
          status: "duplicate",
          result: existing.result,
        });
        continue;
      }

      const applied = await this.applyEvent(params, ev);
      const { error: insertError } = await sb.from("pos_sync_events").insert({
        restaurant_id: params.restaurantId,
        idempotency_key: key,
        event_id: ev.eventId ?? null,
        event_type: ev.type,
        payload: ev.payload ?? {},
        device_id: params.deviceId,
        waiter_profile_id: params.profileId,
        session_id: ev.sessionId ?? null,
        result: applied.result ?? null,
      });

      if (insertError) {
        // unique race → treat as duplicate
        if (insertError.code === "23505") {
          results.push({ idempotencyKey: key, status: "duplicate" });
        } else {
          results.push({
            idempotencyKey: key,
            status: "rejected",
            error: insertError.message,
          });
        }
        continue;
      }

      results.push({
        idempotencyKey: key,
        status: applied.ok ? "applied" : "rejected",
        result: applied.result,
        error: applied.ok ? undefined : applied.error,
      });
    }

    return { results };
  }

  private async applyEvent(
    ctx: { restaurantId: string; profileId: string },
    ev: SyncEventInput,
  ): Promise<{ ok: boolean; result?: unknown; error?: string }> {
    const p = (ev.payload ?? {}) as Record<string, unknown>;
    switch (ev.type) {
      case "session.opened": {
        const r = await this.sessions.open({
          restaurantId: ctx.restaurantId,
          diningTableId: String(p.tableId ?? p.diningTableId ?? ""),
          coverCount: Number(p.coverCount ?? 2),
          profileId: ctx.profileId,
          reservationId: (p.reservationId as string | null) ?? null,
        });
        return r.ok
          ? { ok: true, result: { sessionId: r.sessionId } }
          : { ok: false, error: r.error };
      }
      case "order.line_added":
      case "order.created": {
        const items = Array.isArray(p.items) ? p.items : [p];
        const r = await this.orders.createOrder({
          restaurantId: ctx.restaurantId,
          sessionId: String(ev.sessionId ?? p.sessionId ?? ""),
          profileId: ctx.profileId,
          items: items.map((it) => ({
            menuItemId: String((it as { menuItemId?: string }).menuItemId ?? ""),
            quantity: Number((it as { quantity?: number }).quantity ?? 1),
            course: (it as { course?: string }).course,
            notes: (it as { notes?: string }).notes,
            modifiers: (it as { modifiers?: OrderLineMod[] }).modifiers,
          })),
        });
        return r.ok
          ? { ok: true, result: { orderId: r.orderId, orderNumber: r.orderNumber } }
          : { ok: false, error: r.error };
      }
      case "course.fired": {
        const r = await this.orders.fireCourse({
          restaurantId: ctx.restaurantId,
          sessionId: String(ev.sessionId ?? p.sessionId ?? ""),
          course: String(p.course ?? "main"),
        });
        return r.ok
          ? { ok: true, result: { firedLineIds: r.firedLineIds } }
          : { ok: false, error: r.error };
      }
      case "table.moved": {
        const r = await this.sessions.moveTable({
          restaurantId: ctx.restaurantId,
          sessionId: String(ev.sessionId ?? p.sessionId ?? ""),
          targetDiningTableId: String(p.toTableId ?? p.targetDiningTableId ?? ""),
        });
        return r.ok ? { ok: true, result: r } : { ok: false, error: r.error };
      }
      case "payment.completed": {
        const method = String(p.method ?? "cash");
        const allocations = Array.isArray(p.allocations)
          ? (p.allocations as Array<{ orderLineId: string; quantity: number }>)
          : [];
        if (method === "card" || method === "paypal") {
          const r = await this.payments.createMolliePayment({
            restaurantId: ctx.restaurantId,
            sessionId: String(ev.sessionId ?? p.sessionId ?? ""),
            method,
            amountCents: Number(p.amountCents ?? 0),
            tipCents: Number(p.tipCents ?? 0),
            allocations,
          });
          return r.ok ? { ok: true, result: r } : { ok: false, error: r.error };
        }
        const r = await this.payments.collectCash({
          restaurantId: ctx.restaurantId,
          sessionId: String(ev.sessionId ?? p.sessionId ?? ""),
          allocations,
          tipCents: Number(p.tipCents ?? 0),
          receivedAmountCents:
            p.receivedAmountCents == null ? null : Number(p.receivedAmountCents),
          settlementMode: p.settlementMode === "amount" ? "amount" : "item",
        });
        return r.ok ? { ok: true, result: r } : { ok: false, error: r.error };
      }
      case "table.released": {
        const r = await this.sessions.release({
          restaurantId: ctx.restaurantId,
          sessionId: String(ev.sessionId ?? p.sessionId ?? ""),
          profileId: ctx.profileId,
        });
        return r.ok ? { ok: true, result: { released: true } } : { ok: false, error: r.error };
      }
      default:
        return { ok: false, error: `unsupported_type:${ev.type}` };
    }
  }
}

type OrderLineMod = {
  type?: string;
  label: string;
  priceDeltaCents?: number;
  optionChoiceId?: string;
};

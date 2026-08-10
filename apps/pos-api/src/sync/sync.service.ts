import { Injectable } from "@nestjs/common";
import { normalizePosOrderCourse } from "@gwada/pos-domain";
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
            course: normalizePosOrderCourse((it as { course?: unknown }).course),
            notes: (it as { notes?: string }).notes,
            modifiers: (it as { modifiers?: OrderLineMod[] }).modifiers,
          })),
        });
        return r.ok
          ? {
              ok: true,
              result: {
                orderId: r.orderId,
                orderNumber: r.orderNumber,
                lines: r.lines ?? [],
              },
            }
          : { ok: false, error: r.error };
      }
      case "course.fired": {
        const r = await this.orders.fireCourse({
          restaurantId: ctx.restaurantId,
          sessionId: String(ev.sessionId ?? p.sessionId ?? ""),
          course: normalizePosOrderCourse(p.course),
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
      case "table.merged": {
        const r = await this.sessions.mergeSessions({
          restaurantId: ctx.restaurantId,
          sourceSessionId: String(p.sourceSessionId ?? ""),
          targetSessionId: String(p.targetSessionId ?? ev.sessionId ?? ""),
          coverCount: p.coverCount == null ? undefined : Number(p.coverCount),
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
      case "reservation.seated": {
        const reservationId = String(p.reservationId ?? "").trim();
        const diningTableId = String(p.diningTableId ?? p.tableId ?? "").trim();
        const coverCount = Number(p.coverCount ?? 2);
        if (!reservationId || !diningTableId) {
          return { ok: false, error: "invalid_payload" };
        }

        const sb = this.supabaseAdmin.getClient();

        // Same confirmed gate as Web `seatPosReservation` — before open/seat.
        const { data: reservation } = await sb
          .from("reservations")
          .select(
            "id, restaurant_id, reservation_statuses!reservations_status_id_fkey ( code )",
          )
          .eq("id", reservationId)
          .maybeSingle();
        if (!reservation || reservation.restaurant_id !== ctx.restaurantId) {
          return { ok: false, error: "reservation_not_found" };
        }

        const statusRaw = (reservation as Record<string, unknown>)
          .reservation_statuses;
        const statusOne = Array.isArray(statusRaw) ? statusRaw[0] : statusRaw;
        const statusCode =
          statusOne && typeof statusOne === "object" && "code" in statusOne
            ? String((statusOne as { code: string }).code)
            : "";

        const { data: linkedOpen } = await sb
          .from("pos_table_sessions")
          .select("id")
          .eq("restaurant_id", ctx.restaurantId)
          .eq("reservation_id", reservationId)
          .eq("status", "open")
          .maybeSingle();

        let sessionId = (linkedOpen?.id as string | undefined) ?? null;
        let tableOccupiedByOther = false;

        if (!sessionId) {
          const { data: existingOpen } = await sb
            .from("pos_table_sessions")
            .select("id, reservation_id")
            .eq("dining_table_id", diningTableId)
            .eq("status", "open")
            .maybeSingle();

          if (existingOpen) {
            if ((existingOpen.reservation_id as string | null) === reservationId) {
              sessionId = existingOpen.id as string;
            } else {
              tableOccupiedByOther = true;
            }
          }
        }

        // Sync replay: already seated + linked session → skip (ack success).
        if (statusCode === "seated" && sessionId) {
          return { ok: true, result: { sessionId } };
        }

        if (statusCode !== "confirmed") {
          return { ok: false, error: "invalid_status" };
        }

        if (tableOccupiedByOther) {
          return { ok: false, error: "table_occupied" };
        }

        if (!sessionId) {
          const opened = await this.sessions.open({
            restaurantId: ctx.restaurantId,
            diningTableId,
            coverCount,
            profileId: ctx.profileId,
            reservationId,
          });
          if (!opened.ok) {
            return { ok: false, error: opened.error };
          }
          sessionId = opened.sessionId;

          // sessions.open returns any open session on the table — reject foreign ones.
          const { data: openedRow } = await sb
            .from("pos_table_sessions")
            .select("id, reservation_id")
            .eq("id", sessionId)
            .maybeSingle();
          if (
            openedRow &&
            (openedRow.reservation_id as string | null) !== reservationId
          ) {
            return { ok: false, error: "table_occupied" };
          }
        }

        const { data: seatedStatus } = await sb
          .from("reservation_statuses")
          .select("id")
          .eq("code", "seated")
          .maybeSingle();
        const seatedStatusId = seatedStatus?.id as string | undefined;
        if (!seatedStatusId) {
          return { ok: false, error: "seated_status_missing" };
        }

        const { error: updateError } = await sb
          .from("reservations")
          .update({
            status_id: seatedStatusId,
            dining_table_id: diningTableId,
          })
          .eq("id", reservationId)
          .eq("restaurant_id", ctx.restaurantId);

        if (updateError) {
          return { ok: false, error: updateError.message };
        }

        return { ok: true, result: { sessionId } };
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

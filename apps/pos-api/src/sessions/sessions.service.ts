import { Injectable } from "@nestjs/common";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseAdminService } from "../supabase-admin.service";

const ACTIVE_SESSION_STATUSES = ["open", "bill", "paid_pending_release"] as const;

@Injectable()
export class RegisterGateService {
  constructor(private readonly supabaseAdmin: SupabaseAdminService) {}

  /** Returns open register session id or null. Skippable via POS_SKIP_REGISTER_CHECK=1. */
  async requireOpenRegister(restaurantId: string): Promise<string | null> {
    if (process.env.POS_SKIP_REGISTER_CHECK === "1") return "skipped";
    const sb = this.supabaseAdmin.getClient();
    const { data } = await sb
      .from("pos_register_sessions")
      .select("id")
      .eq("restaurant_id", restaurantId)
      .is("closed_at", null)
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data?.id as string | undefined) ?? null;
  }
}

@Injectable()
export class SessionsService {
  constructor(
    private readonly supabaseAdmin: SupabaseAdminService,
    private readonly registerGate: RegisterGateService,
  ) {}

  private sb(): SupabaseClient {
    return this.supabaseAdmin.getClient();
  }

  async listFloor(restaurantId: string) {
    const sb = this.sb();
    const [{ data: tables }, { data: sessions }] = await Promise.all([
      sb
        .from("dining_tables")
        .select("id, table_number, table_name, capacity, area_id, is_active")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .order("table_number", { ascending: true }),
      sb
        .from("pos_table_sessions")
        .select(
          "id, dining_table_id, status, cover_count, owner_profile_id, opened_at, is_fully_paid, settlement_mode, settled_cents, even_n",
        )
        .eq("restaurant_id", restaurantId)
        .in("status", [...ACTIVE_SESSION_STATUSES]),
    ]);

    const sessionByTable = new Map(
      (sessions ?? []).map((s) => [s.dining_table_id as string, s]),
    );

    return {
      tables: (tables ?? []).map((t) => {
        const s = sessionByTable.get(t.id as string);
        return {
          id: t.id,
          number: t.table_number,
          name: t.table_name ?? String(t.table_number),
          capacity: t.capacity,
          areaId: t.area_id,
          session: s
            ? {
                id: s.id,
                status: s.status,
                coverCount: s.cover_count,
                ownerProfileId: s.owner_profile_id,
                openedAt: s.opened_at,
                isFullyPaid: s.is_fully_paid,
                settlementMode: s.settlement_mode,
                settledCents: s.settled_cents,
                evenN: s.even_n,
              }
            : null,
        };
      }),
    };
  }

  async open(params: {
    restaurantId: string;
    diningTableId: string;
    coverCount: number;
    profileId: string;
    reservationId?: string | null;
  }) {
    const register = await this.registerGate.requireOpenRegister(params.restaurantId);
    if (!register) return { ok: false as const, error: "register_closed", status: 403 };

    const sb = this.sb();
    const { data: table } = await sb
      .from("dining_tables")
      .select("id, restaurant_id, is_active")
      .eq("id", params.diningTableId)
      .maybeSingle();
    if (!table || table.restaurant_id !== params.restaurantId) {
      return { ok: false as const, error: "table_not_found", status: 404 };
    }
    if (!table.is_active) {
      return { ok: false as const, error: "table_inactive", status: 400 };
    }

    const { data: existing } = await sb
      .from("pos_table_sessions")
      .select("id")
      .eq("dining_table_id", params.diningTableId)
      .in("status", [...ACTIVE_SESSION_STATUSES])
      .maybeSingle();
    if (existing) return { ok: true as const, sessionId: existing.id as string };

    const cover = Math.min(50, Math.max(1, Math.round(params.coverCount || 2)));
    const { data, error } = await sb
      .from("pos_table_sessions")
      .insert({
        restaurant_id: params.restaurantId,
        dining_table_id: params.diningTableId,
        cover_count: cover,
        opened_by_profile_id: params.profileId,
        owner_profile_id: params.profileId,
        reservation_id: params.reservationId ?? null,
        status: "open",
        settlement_mode: "item",
        settled_cents: 0,
        even_n: Math.max(2, cover),
      })
      .select("id")
      .single();

    if (error || !data) {
      return { ok: false as const, error: error?.message ?? "create_failed", status: 500 };
    }
    return { ok: true as const, sessionId: data.id as string };
  }

  async getSummary(restaurantId: string, sessionId: string) {
    const sb = this.sb();
    const { data: session } = await sb
      .from("pos_table_sessions")
      .select(
        "id, restaurant_id, dining_table_id, status, cover_count, owner_profile_id, opened_at, is_fully_paid, settlement_mode, settled_cents, even_n",
      )
      .eq("id", sessionId)
      .eq("restaurant_id", restaurantId)
      .maybeSingle();
    if (!session) return { ok: false as const, error: "session_not_found", status: 404 };

    const { data: orders } = await sb
      .from("pos_orders")
      .select("id, order_number, status, total_cents, tip_cents")
      .eq("table_session_id", sessionId)
      .neq("status", "cancelled")
      .order("order_number", { ascending: true });

    const orderIds = (orders ?? []).map((o) => o.id as string);
    const { data: lines } =
      orderIds.length === 0
        ? { data: [] as Record<string, unknown>[] }
        : await sb
            .from("pos_order_lines")
            .select(
              "id, order_id, menu_item_id, name, quantity, paid_quantity, unit_price_cents, line_total_cents, vat_rate, notes, course, modifiers, fired_at, position",
            )
            .in("order_id", orderIds)
            .order("position", { ascending: true });

    return {
      ok: true as const,
      summary: {
        session,
        orders: orders ?? [],
        lines: lines ?? [],
      },
    };
  }

  async setBill(restaurantId: string, sessionId: string) {
    const sb = this.sb();
    const { data, error } = await sb
      .from("pos_table_sessions")
      .update({ status: "bill" })
      .eq("id", sessionId)
      .eq("restaurant_id", restaurantId)
      .in("status", ["open", "bill"])
      .select("id, status")
      .maybeSingle();
    if (error || !data) return { ok: false as const, error: "update_failed", status: 400 };
    return { ok: true as const, status: data.status as string };
  }

  async markPaidPendingRelease(restaurantId: string, sessionId: string) {
    const sb = this.sb();
    const { data, error } = await sb
      .from("pos_table_sessions")
      .update({ status: "paid_pending_release", is_fully_paid: true })
      .eq("id", sessionId)
      .eq("restaurant_id", restaurantId)
      .select("id, status")
      .maybeSingle();
    if (error || !data) return { ok: false as const, error: "update_failed", status: 400 };
    return { ok: true as const, status: data.status as string };
  }

  async release(params: {
    restaurantId: string;
    sessionId: string;
    profileId: string;
  }) {
    const sb = this.sb();
    const { data: session } = await sb
      .from("pos_table_sessions")
      .select("id, status, is_fully_paid")
      .eq("id", params.sessionId)
      .eq("restaurant_id", params.restaurantId)
      .maybeSingle();
    if (!session) return { ok: false as const, error: "session_not_found", status: 404 };

    // Allow release if paid_pending_release OR open with no unsent kitchen work (client enforces)
    if (
      session.status !== "paid_pending_release" &&
      session.status !== "open" &&
      session.status !== "bill"
    ) {
      return { ok: false as const, error: "invalid_status", status: 400 };
    }

    const { error } = await sb
      .from("pos_table_sessions")
      .update({
        status: "closed",
        closed_at: new Date().toISOString(),
      })
      .eq("id", params.sessionId);

    if (error) return { ok: false as const, error: error.message, status: 500 };
    return { ok: true as const };
  }

  async moveTable(params: {
    restaurantId: string;
    sessionId: string;
    targetDiningTableId: string;
  }) {
    const sb = this.sb();
    const { data: session } = await sb
      .from("pos_table_sessions")
      .select("id, status, dining_table_id")
      .eq("id", params.sessionId)
      .eq("restaurant_id", params.restaurantId)
      .maybeSingle();
    if (!session) return { ok: false as const, error: "session_not_found", status: 404 };
    if (!ACTIVE_SESSION_STATUSES.includes(session.status as (typeof ACTIVE_SESSION_STATUSES)[number])) {
      return { ok: false as const, error: "session_not_active", status: 400 };
    }

    const { data: target } = await sb
      .from("dining_tables")
      .select("id, restaurant_id, is_active")
      .eq("id", params.targetDiningTableId)
      .maybeSingle();
    if (!target || target.restaurant_id !== params.restaurantId || !target.is_active) {
      return { ok: false as const, error: "target_not_found", status: 404 };
    }

    const { data: occupied } = await sb
      .from("pos_table_sessions")
      .select("id")
      .eq("dining_table_id", params.targetDiningTableId)
      .in("status", [...ACTIVE_SESSION_STATUSES])
      .maybeSingle();
    if (occupied) return { ok: false as const, error: "target_occupied", status: 409 };

    const { error } = await sb
      .from("pos_table_sessions")
      .update({ dining_table_id: params.targetDiningTableId })
      .eq("id", params.sessionId);
    if (error) return { ok: false as const, error: error.message, status: 500 };
    return {
      ok: true as const,
      fromTableId: session.dining_table_id as string,
      toTableId: params.targetDiningTableId,
    };
  }
}

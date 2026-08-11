import { Injectable } from "@nestjs/common";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseAdminService } from "../supabase-admin.service";

/** Mirror of web `cashSaleIdempotencyKey` — prefer client attempt when present. */
export function cashSaleIdempotencyKey(
  paymentId: string,
  clientAttemptId?: string | null,
): string {
  const attempt = clientAttemptId?.trim();
  return attempt ? `cash_sale:${attempt}` : `cash_sale:${paymentId}`;
}

/** Soll = opening_float_cents + sum(cash_sale) − sum(drop_in); float_out is informational only. */
export function bagExpectedCents(params: {
  openingFloatCents: number;
  movements: { kind: string; amount_cents: number }[];
}): number {
  let sales = 0;
  let drops = 0;
  for (const m of params.movements) {
    if (m.kind === "cash_sale") sales += m.amount_cents;
    if (m.kind === "drop_in") drops += m.amount_cents;
  }
  return params.openingFloatCents + sales - drops;
}

type CashBagMovementRow = {
  kind: string;
  amount_cents: number;
};

type WaiterCashBagRow = {
  id: string;
  restaurant_id: string;
  register_session_id: string;
  /** `profiles.id` of the waiter who holds the bag — not `restaurant_staff.id`. */
  staff_profile_id: string;
  status: string;
  opening_float_cents: number;
};

/**
 * Thin Nest mirror of apps/web/lib/pos/waiter-cash-bag-server.
 * Keep rules in sync with the Next.js helper (Task 2–4).
 *
 * Multi-step bag writes use ordering + compensating deletes; the Supabase JS
 * admin client cannot run SQL transactions across separate table calls.
 */
@Injectable()
export class CashBagsService {
  constructor(private readonly supabaseAdmin: SupabaseAdminService) {}

  private sb(): SupabaseClient {
    return this.supabaseAdmin.getClient();
  }

  private async getOpenRegisterSessionId(
    restaurantId: string,
  ): Promise<string | null> {
    if (process.env.POS_SKIP_REGISTER_CHECK === "1") return "skipped";
    const { data } = await this.sb()
      .from("pos_register_sessions")
      .select("id")
      .eq("restaurant_id", restaurantId)
      .is("closed_at", null)
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data?.id as string | undefined) ?? null;
  }

  private async findOpenBagForStaff(
    restaurantId: string,
    staffProfileId: string,
  ): Promise<WaiterCashBagRow | null> {
    const { data } = await this.sb()
      .from("pos_waiter_cash_bags")
      .select(
        "id, restaurant_id, register_session_id, staff_profile_id, status, opening_float_cents",
      )
      .eq("restaurant_id", restaurantId)
      .eq("staff_profile_id", staffProfileId)
      .eq("status", "open")
      .maybeSingle();
    return (data as WaiterCashBagRow | null) ?? null;
  }

  private async loadBagMovements(
    cashBagId: string,
  ): Promise<CashBagMovementRow[]> {
    const { data, error } = await this.sb()
      .from("pos_waiter_cash_bag_movements")
      .select("kind, amount_cents")
      .eq("cash_bag_id", cashBagId)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("[pos-api] load bag movements", error.message);
      return [];
    }
    return (data ?? []) as CashBagMovementRow[];
  }

  private async findBagByIdempotencyKey(
    restaurantId: string,
    idempotencyKey: string,
  ): Promise<string | null> {
    const { data } = await this.sb()
      .from("pos_waiter_cash_bag_movements")
      .select("cash_bag_id")
      .eq("restaurant_id", restaurantId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    return (data?.cash_bag_id as string | undefined) ?? null;
  }

  private async loadDiffThresholdCents(restaurantId: string): Promise<number> {
    const { data } = await this.sb()
      .from("pos_restaurant_fiscal_config")
      .select("waiter_cash_bag_diff_threshold_cents")
      .eq("restaurant_id", restaurantId)
      .maybeSingle();
    const threshold = Number(data?.waiter_cash_bag_diff_threshold_cents ?? 500);
    return Number.isFinite(threshold) && threshold >= 0 ? threshold : 500;
  }

  /**
   * Server-side manager PIN for cash_bag.closed (web `/api/pos/cash-bags/close` parity).
   * Never trust a client `managerPinVerified` boolean alone.
   */
  async verifyManagerPinForClose(
    restaurantId: string,
    managerPin: string | null | undefined,
  ): Promise<
    | { ok: true; verified: false }
    | { ok: true; verified: true; profileId: string }
    | { ok: false; error: string }
  > {
    const pin = (managerPin ?? "").trim();
    if (!pin) {
      return { ok: true, verified: false };
    }
    if (!/^[0-9]{4}$/.test(pin)) {
      return { ok: false, error: "invalid_manager_pin" };
    }
    if (process.env.POS_AUTH_RELAXED === "1") {
      return { ok: true, verified: true, profileId: "relaxed-manager" };
    }

    const sb = this.sb();
    const { data: resolved } = await sb.rpc(
      "resolve_restaurant_staff_by_display_pin",
      {
        p_restaurant_id: restaurantId,
        p_pin: pin,
      },
    );
    const staffId =
      (typeof resolved === "string"
        ? resolved
        : Array.isArray(resolved)
          ? (resolved[0] as string | undefined)
          : null) ?? null;
    if (!staffId) {
      return { ok: false, error: "invalid_manager_pin" };
    }

    const { data: keys } = await sb.rpc("staff_display_permission_keys", {
      p_staff_id: staffId,
    });
    const keySet = new Set<string>((keys as string[] | null) ?? []);
    if (!keySet.has("pos.kasse.manage")) {
      return { ok: false, error: "manager_pin_forbidden" };
    }

    const { data: staff } = await sb
      .from("restaurant_staff")
      .select("profile_id")
      .eq("id", staffId)
      .maybeSingle();
    const profileId = (staff?.profile_id as string | null)?.trim() ?? "";
    if (!profileId) {
      return { ok: false, error: "manager_profile_missing" };
    }
    return { ok: true, verified: true, profileId };
  }

  /** Compensating delete — movements have no FK cascade to pos_payments. */
  async deleteCashSaleMovementForPayment(params: {
    restaurantId: string;
    paymentId: string;
  }): Promise<void> {
    const { error } = await this.sb()
      .from("pos_waiter_cash_bag_movements")
      .delete()
      .eq("restaurant_id", params.restaurantId)
      .eq("payment_id", params.paymentId)
      .eq("kind", "cash_sale");
    if (error) {
      console.warn(
        "[pos-api] delete cash_sale movement for payment",
        params.paymentId,
        error.message,
      );
    }
  }

  async applyCashSaleToOpenBag(params: {
    restaurantId: string;
    cashierProfileId: string;
    paymentId: string;
    amountCents: number;
    idempotencyKey: string;
  }): Promise<{ ok: true; bagId: string } | { ok: false; error: string; status: number }> {
    const sb = this.sb();
    const amountCents = Math.max(0, Math.round(params.amountCents));
    const idempotencyKey = params.idempotencyKey.trim();
    if (!idempotencyKey) {
      return { ok: false, error: "idempotency_key_required", status: 400 };
    }

    const existingBagId = await this.findBagByIdempotencyKey(
      params.restaurantId,
      idempotencyKey,
    );
    if (existingBagId) {
      return { ok: true, bagId: existingBagId };
    }

    const openBag = await this.findOpenBagForStaff(
      params.restaurantId,
      params.cashierProfileId,
    );
    if (!openBag) {
      return { ok: false, error: "no_open_bag", status: 409 };
    }

    const { data: movement, error: movementError } = await sb
      .from("pos_waiter_cash_bag_movements")
      .insert({
        restaurant_id: params.restaurantId,
        cash_bag_id: openBag.id,
        register_session_id: openBag.register_session_id,
        kind: "cash_sale",
        amount_cents: amountCents,
        payment_id: params.paymentId,
        idempotency_key: idempotencyKey,
        created_by_profile_id: params.cashierProfileId,
      })
      .select("id")
      .single();

    if (movementError) {
      if (movementError.code === "23505") {
        const raced = await this.findBagByIdempotencyKey(
          params.restaurantId,
          idempotencyKey,
        );
        if (raced) {
          return { ok: true, bagId: raced };
        }
      }
      return { ok: false, error: movementError.message, status: 500 };
    }
    if (!movement) {
      return { ok: false, error: "movement_insert_failed", status: 500 };
    }

    const { error: paymentError } = await sb
      .from("pos_payments")
      .update({
        cashier_profile_id: params.cashierProfileId,
        cash_bag_id: openBag.id,
      })
      .eq("id", params.paymentId)
      .eq("restaurant_id", params.restaurantId);

    if (paymentError) {
      await sb.from("pos_waiter_cash_bag_movements").delete().eq("id", movement.id);
      return { ok: false, error: paymentError.message, status: 500 };
    }

    return { ok: true, bagId: openBag.id as string };
  }

  async issue(params: {
    restaurantId: string;
    staffProfileId: string;
    openingFloatCents: number;
    issuedByProfileId: string;
    idempotencyKey: string;
  }): Promise<{ ok: true; bagId: string } | { ok: false; error: string; status: number }> {
    const sb = this.sb();
    const openingFloatCents = Math.max(0, Math.round(params.openingFloatCents));
    const idempotencyKey = params.idempotencyKey.trim();
    if (!idempotencyKey) {
      return { ok: false, error: "idempotency_key_required", status: 400 };
    }

    const existingBagId = await this.findBagByIdempotencyKey(
      params.restaurantId,
      idempotencyKey,
    );
    if (existingBagId) {
      return { ok: true, bagId: existingBagId };
    }

    const registerSessionId = await this.getOpenRegisterSessionId(
      params.restaurantId,
    );
    if (!registerSessionId) {
      return { ok: false, error: "register_not_open", status: 409 };
    }

    const existingOpenBag = await this.findOpenBagForStaff(
      params.restaurantId,
      params.staffProfileId,
    );
    if (existingOpenBag) {
      return { ok: false, error: "staff_already_has_open_bag", status: 409 };
    }

    const { data: bag, error: bagError } = await sb
      .from("pos_waiter_cash_bags")
      .insert({
        restaurant_id: params.restaurantId,
        register_session_id: registerSessionId,
        staff_profile_id: params.staffProfileId,
        status: "open",
        opening_float_cents: openingFloatCents,
        opened_by_profile_id: params.issuedByProfileId,
      })
      .select("id")
      .single();

    if (bagError || !bag) {
      if (bagError?.code === "23505") {
        return { ok: false, error: "staff_already_has_open_bag", status: 409 };
      }
      return { ok: false, error: bagError?.message ?? "bag_insert_failed", status: 500 };
    }

    const { error: movementError } = await sb
      .from("pos_waiter_cash_bag_movements")
      .insert({
        restaurant_id: params.restaurantId,
        cash_bag_id: bag.id,
        register_session_id: registerSessionId,
        kind: "float_out",
        amount_cents: openingFloatCents,
        idempotency_key: idempotencyKey,
        created_by_profile_id: params.issuedByProfileId,
      });

    if (movementError) {
      if (movementError.code === "23505") {
        const replayBagId = await this.findBagByIdempotencyKey(
          params.restaurantId,
          idempotencyKey,
        );
        if (replayBagId) {
          return { ok: true, bagId: replayBagId };
        }
      }
      await sb.from("pos_waiter_cash_bags").delete().eq("id", bag.id);
      return { ok: false, error: movementError.message, status: 500 };
    }

    return { ok: true, bagId: bag.id as string };
  }

  async close(params: {
    restaurantId: string;
    bagId: string;
    closingCountCents: number;
    closedByProfileId: string;
    managerOverrideProfileId?: string | null;
    managerPinVerified: boolean;
  }): Promise<
    | { ok: true; differenceCents: number }
    | { ok: false; error: string; status: number }
  > {
    const sb = this.sb();
    const closingCountCents = Math.max(0, Math.round(params.closingCountCents));

    const { data: bag, error: bagError } = await sb
      .from("pos_waiter_cash_bags")
      .select(
        "id, restaurant_id, register_session_id, staff_profile_id, status, opening_float_cents",
      )
      .eq("id", params.bagId)
      .eq("restaurant_id", params.restaurantId)
      .maybeSingle();

    if (bagError || !bag) {
      return { ok: false, error: "bag_not_found", status: 404 };
    }
    if (bag.status !== "open") {
      return { ok: false, error: "bag_not_open", status: 409 };
    }

    const movements = await this.loadBagMovements(bag.id as string);
    const expectedCents = bagExpectedCents({
      openingFloatCents: Number(bag.opening_float_cents),
      movements,
    });
    const differenceCents = closingCountCents - expectedCents;

    const thresholdCents = await this.loadDiffThresholdCents(params.restaurantId);
    if (Math.abs(differenceCents) >= thresholdCents && !params.managerPinVerified) {
      return { ok: false, error: "manager_pin_required", status: 403 };
    }

    const { data: closeMovement, error: movementError } = await sb
      .from("pos_waiter_cash_bag_movements")
      .insert({
        restaurant_id: params.restaurantId,
        cash_bag_id: bag.id,
        register_session_id: bag.register_session_id,
        kind: "close_count",
        amount_cents: closingCountCents,
        created_by_profile_id: params.closedByProfileId,
      })
      .select("id")
      .single();

    if (movementError || !closeMovement) {
      return {
        ok: false,
        error: movementError?.message ?? "movement_insert_failed",
        status: 500,
      };
    }

    const closedAt = new Date().toISOString();
    const { error: updateError } = await sb
      .from("pos_waiter_cash_bags")
      .update({
        status: "closed",
        closing_count_cents: closingCountCents,
        difference_cents: differenceCents,
        closed_at: closedAt,
        closed_by_profile_id: params.closedByProfileId,
        manager_override_profile_id:
          Math.abs(differenceCents) >= thresholdCents
            ? (params.managerOverrideProfileId ?? null)
            : null,
      })
      .eq("id", bag.id);

    if (updateError) {
      await sb.from("pos_waiter_cash_bag_movements").delete().eq("id", closeMovement.id);
      return { ok: false, error: updateError.message, status: 500 };
    }

    return { ok: true, differenceCents };
  }

  /**
   * Idempotent replay: from bag already handed_over → open to bag owned by recipient.
   */
  async resolveHandoverReplay(params: {
    restaurantId: string;
    fromProfileId: string;
    toProfileId: string;
  }): Promise<{ toBagId: string } | null> {
    const sb = this.sb();

    const { data: fromBag } = await sb
      .from("pos_waiter_cash_bags")
      .select("handed_over_to_bag_id")
      .eq("restaurant_id", params.restaurantId)
      .eq("staff_profile_id", params.fromProfileId)
      .eq("status", "handed_over")
      .not("handed_over_to_bag_id", "is", null)
      .order("closed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const toBagId = fromBag?.handed_over_to_bag_id as string | undefined;
    if (!toBagId) return null;

    const { data: toBag } = await sb
      .from("pos_waiter_cash_bags")
      .select("id, staff_profile_id, status")
      .eq("id", toBagId)
      .maybeSingle();

    if (
      !toBag ||
      toBag.status !== "open" ||
      toBag.staff_profile_id !== params.toProfileId
    ) {
      return null;
    }

    return { toBagId: toBag.id as string };
  }

  async handover(params: {
    restaurantId: string;
    fromProfileId: string;
    toProfileId: string;
  }): Promise<
    { ok: true; toBagId: string } | { ok: false; error: string; status: number }
  > {
    const sb = this.sb();

    if (params.fromProfileId === params.toProfileId) {
      return { ok: false, error: "same_staff", status: 400 };
    }

    const registerSessionId = await this.getOpenRegisterSessionId(
      params.restaurantId,
    );
    if (!registerSessionId) {
      return { ok: false, error: "register_not_open", status: 409 };
    }

    const fromBag = await this.findOpenBagForStaff(
      params.restaurantId,
      params.fromProfileId,
    );
    if (!fromBag) {
      return { ok: false, error: "from_bag_not_open", status: 404 };
    }
    if (
      registerSessionId !== "skipped" &&
      fromBag.register_session_id !== registerSessionId
    ) {
      return { ok: false, error: "stale_bag_session", status: 409 };
    }

    const toOpenBag = await this.findOpenBagForStaff(
      params.restaurantId,
      params.toProfileId,
    );
    if (toOpenBag) {
      return { ok: false, error: "to_already_has_open_bag", status: 409 };
    }

    const fromMovements = await this.loadBagMovements(fromBag.id);
    const handoverAmountCents = bagExpectedCents({
      openingFloatCents: Number(fromBag.opening_float_cents),
      movements: fromMovements,
    });

    const sessionIdForTo =
      registerSessionId === "skipped"
        ? fromBag.register_session_id
        : registerSessionId;

    const { data: toBag, error: toBagError } = await sb
      .from("pos_waiter_cash_bags")
      .insert({
        restaurant_id: params.restaurantId,
        register_session_id: sessionIdForTo,
        staff_profile_id: params.toProfileId,
        status: "open",
        opening_float_cents: handoverAmountCents,
        opened_by_profile_id: params.toProfileId,
      })
      .select("id")
      .single();

    if (toBagError || !toBag) {
      if (toBagError?.code === "23505") {
        return { ok: false, error: "to_already_has_open_bag", status: 409 };
      }
      return {
        ok: false,
        error: toBagError?.message ?? "bag_insert_failed",
        status: 500,
      };
    }

    const handedOverAt = new Date().toISOString();
    const { error: fromUpdateError } = await sb
      .from("pos_waiter_cash_bags")
      .update({
        status: "handed_over",
        closed_at: handedOverAt,
        handed_over_to_bag_id: toBag.id,
      })
      .eq("id", fromBag.id)
      .eq("status", "open");

    if (fromUpdateError) {
      await sb.from("pos_waiter_cash_bags").delete().eq("id", toBag.id);
      return { ok: false, error: fromUpdateError.message, status: 500 };
    }

    const movementRows = [
      {
        restaurant_id: params.restaurantId,
        cash_bag_id: fromBag.id,
        register_session_id: fromBag.register_session_id,
        kind: "handover",
        amount_cents: handoverAmountCents,
        created_by_profile_id: params.fromProfileId,
      },
      {
        restaurant_id: params.restaurantId,
        cash_bag_id: toBag.id,
        register_session_id: sessionIdForTo,
        kind: "handover",
        amount_cents: handoverAmountCents,
        created_by_profile_id: params.toProfileId,
      },
    ];

    const { error: movementError } = await sb
      .from("pos_waiter_cash_bag_movements")
      .insert(movementRows);

    if (movementError) {
      await sb
        .from("pos_waiter_cash_bags")
        .update({
          status: "open",
          closed_at: null,
          handed_over_to_bag_id: null,
        })
        .eq("id", fromBag.id);
      await sb.from("pos_waiter_cash_bags").delete().eq("id", toBag.id);
      return { ok: false, error: movementError.message, status: 500 };
    }

    return { ok: true, toBagId: toBag.id as string };
  }
}

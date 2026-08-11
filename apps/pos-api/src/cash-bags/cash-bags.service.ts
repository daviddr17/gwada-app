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

/**
 * Thin Nest mirror of apps/web/lib/pos/waiter-cash-bag-server applyCashSaleToOpenBag.
 * Keep rules in sync with the Next.js helper (Task 2/3).
 */
@Injectable()
export class CashBagsService {
  constructor(private readonly supabaseAdmin: SupabaseAdminService) {}

  private sb(): SupabaseClient {
    return this.supabaseAdmin.getClient();
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

    const { data: existing } = await sb
      .from("pos_waiter_cash_bag_movements")
      .select("cash_bag_id")
      .eq("restaurant_id", params.restaurantId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (existing?.cash_bag_id) {
      return { ok: true, bagId: existing.cash_bag_id as string };
    }

    const { data: openBag } = await sb
      .from("pos_waiter_cash_bags")
      .select("id, register_session_id")
      .eq("restaurant_id", params.restaurantId)
      .eq("staff_profile_id", params.cashierProfileId)
      .eq("status", "open")
      .maybeSingle();

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
        const { data: raced } = await sb
          .from("pos_waiter_cash_bag_movements")
          .select("cash_bag_id")
          .eq("restaurant_id", params.restaurantId)
          .eq("idempotency_key", idempotencyKey)
          .maybeSingle();
        if (raced?.cash_bag_id) {
          return { ok: true, bagId: raced.cash_bag_id as string };
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
}

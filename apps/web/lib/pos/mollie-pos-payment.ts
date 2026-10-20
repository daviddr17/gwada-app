import "server-only";

import { mollieAmountEur } from "@/lib/mollie/mollie-amount";
import {
  mollieCreatePayment,
  mollieGetPayment,
  mollieListTerminals,
  type MollieTerminal,
} from "@/lib/mollie/mollie-payments";
import { getRestaurantMollieAccess } from "@/lib/mollie/restaurant-mollie-access";
import { getPublicSiteUrl } from "@/lib/public-env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function posWebhookUrl(): string {
  const site = getPublicSiteUrl() || "https://gwada.app";
  return `${site.replace(/\/$/, "")}/api/pos/mollie/webhook`;
}

export async function listRestaurantMollieTerminals(
  restaurantId: string,
): Promise<
  | { ok: true; terminals: MollieTerminal[] }
  | { ok: false; error: string; status: number }
> {
  const access = await getRestaurantMollieAccess(restaurantId);
  if (!access.ok) {
    return { ok: false, error: access.error, status: access.status };
  }
  const listed = await mollieListTerminals(access.auth);
  if (!listed.ok) {
    return {
      ok: false,
      error: listed.detail || "terminals_list_failed",
      status: 502,
    };
  }
  return {
    ok: true,
    terminals: listed.data._embedded?.terminals ?? [],
  };
}

export async function createMolliePosPayment(input: {
  restaurantId: string;
  amountEuros: number;
  description: string;
  terminalId: string;
  posOrderId?: string | null;
}): Promise<
  | {
      ok: true;
      molliePaymentId: string;
      status: string;
    }
  | { ok: false; error: string; status: number }
> {
  if (!(input.amountEuros > 0)) {
    return { ok: false, error: "invalid_amount", status: 400 };
  }
  if (!input.terminalId.startsWith("term_")) {
    return { ok: false, error: "terminal_required", status: 400 };
  }

  const access = await getRestaurantMollieAccess(input.restaurantId);
  if (!access.ok) {
    return { ok: false, error: access.error, status: access.status };
  }

  const payment = await mollieCreatePayment(access.auth, {
    amount: mollieAmountEur(input.amountEuros),
    description: input.description,
    method: "pointofsale",
    terminalId: input.terminalId,
    webhookUrl: posWebhookUrl(),
    ...(access.profileId ? { profileId: access.profileId } : {}),
    metadata: {
      restaurant_id: input.restaurantId,
      purpose: "pos",
      ...(input.posOrderId ? { pos_order_id: input.posOrderId } : {}),
    },
  });

  if (!payment.ok) {
    // Common until Mollie partner/hardware is approved
    if (
      /terminal|point.of.sale|not.enabled|not activated/i.test(
        payment.detail || "",
      )
    ) {
      return {
        ok: false,
        error: "mollie_pos_not_enabled",
        status: 503,
      };
    }
    return {
      ok: false,
      error: payment.detail || "pos_payment_failed",
      status: 502,
    };
  }

  const admin = createSupabaseAdminClient();
  if (admin && input.posOrderId) {
    await admin
      .from("pos_payments")
      .insert({
        restaurant_id: input.restaurantId,
        order_id: input.posOrderId,
        method: "terminal",
        amount_cents: Math.round(input.amountEuros * 100),
        status: payment.data.status === "paid" ? "paid" : "open",
        mollie_payment_id: payment.data.id,
        paid_at: payment.data.paidAt ?? null,
      })
      .then(({ error }) => {
        if (error) console.warn("pos_payments insert", error.message);
      });
  }

  return {
    ok: true,
    molliePaymentId: payment.data.id,
    status: payment.data.status,
  };
}

export async function recheckMolliePosPayment(input: {
  restaurantId: string;
  molliePaymentId: string;
}): Promise<
  | { ok: true; status: string; paid: boolean }
  | { ok: false; error: string; status: number }
> {
  const access = await getRestaurantMollieAccess(input.restaurantId);
  if (!access.ok) {
    return { ok: false, error: access.error, status: access.status };
  }
  const payment = await mollieGetPayment(access.auth, input.molliePaymentId);
  if (!payment.ok) {
    return {
      ok: false,
      error: payment.detail || "payment_fetch_failed",
      status: 502,
    };
  }

  const mappedStatus =
    payment.data.status === "paid"
      ? "paid"
      : payment.data.status === "failed" ||
          payment.data.status === "canceled" ||
          payment.data.status === "expired"
        ? "failed"
        : "open";

  const admin = createSupabaseAdminClient();
  if (admin) {
    await admin
      .from("pos_payments")
      .update({
        status: mappedStatus,
        paid_at: payment.data.paidAt ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("mollie_payment_id", input.molliePaymentId)
      .eq("restaurant_id", input.restaurantId);
  }

  return {
    ok: true,
    status: payment.data.status,
    paid: payment.data.status === "paid",
  };
}

export async function processPosMollieWebhook(
  paymentId: string,
): Promise<{ processed: boolean }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { processed: false };

  const { data: row } = await admin
    .from("pos_payments")
    .select("restaurant_id")
    .eq("mollie_payment_id", paymentId)
    .maybeSingle();

  const restaurantId = (row?.restaurant_id as string | undefined) ?? null;
  if (!restaurantId) return { processed: false };

  const result = await recheckMolliePosPayment({
    restaurantId,
    molliePaymentId: paymentId,
  });
  return { processed: result.ok };
}

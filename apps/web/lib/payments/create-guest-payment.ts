import "server-only";

import { mollieConfigFromJson } from "@/lib/integrations/platform-mollie-config";
import { mollieAmountEur } from "@/lib/mollie/mollie-amount";
import {
  mapMolliePaymentStatusToGuest,
  mollieCreatePayment,
  mollieCreatePaymentLink,
  mollieGetPayment,
} from "@/lib/mollie/mollie-payments";
import { getRestaurantMollieAccess } from "@/lib/mollie/restaurant-mollie-access";
import { getPublicSiteUrl } from "@/lib/public-env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type GuestPaymentPurpose =
  | "deposit"
  | "order"
  | "payment_link"
  | "generic";

export type CreateGuestPaymentInput = {
  restaurantId: string;
  amountEuros: number;
  description: string;
  purpose?: GuestPaymentPurpose;
  redirectUrl: string;
  cancelUrl?: string;
  /** Prefer Payment Links API when true. */
  asPaymentLink?: boolean;
  metadata?: Record<string, string>;
};

function guestWebhookUrl(): string {
  const site = getPublicSiteUrl() || "https://gwada.app";
  return `${site.replace(/\/$/, "")}/api/payments/mollie/webhook`;
}

async function applicationFeeBody(): Promise<
  Record<string, unknown> | undefined
> {
  const admin = createSupabaseAdminClient();
  if (!admin) return undefined;
  const { data } = await admin
    .from("platform_integrations")
    .select("config")
    .eq("key", "mollie")
    .maybeSingle();
  const config = mollieConfigFromJson(data?.config);
  const fee = Number.parseFloat(config.application_fee_eur || "0");
  if (!Number.isFinite(fee) || fee <= 0) return undefined;
  return {
    applicationFee: {
      amount: mollieAmountEur(fee),
      description: "Gwada Plattformgebühr",
    },
  };
}

export async function createRestaurantGuestPayment(
  input: CreateGuestPaymentInput,
): Promise<
  | {
      ok: true;
      id: string;
      checkoutUrl: string | null;
      molliePaymentId: string | null;
      molliePaymentLinkId: string | null;
    }
  | { ok: false; error: string; status: number }
> {
  if (!(input.amountEuros > 0)) {
    return { ok: false, error: "invalid_amount", status: 400 };
  }
  const access = await getRestaurantMollieAccess(input.restaurantId);
  if (!access.ok) {
    return { ok: false, error: access.error, status: access.status };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "server_misconfigured", status: 503 };

  const amount = mollieAmountEur(input.amountEuros);
  const purpose = input.purpose ?? "generic";
  const fee = await applicationFeeBody();
  const metadata = {
    restaurant_id: input.restaurantId,
    purpose,
    ...(input.metadata ?? {}),
  };

  let checkoutUrl: string | null = null;
  let molliePaymentId: string | null = null;
  let molliePaymentLinkId: string | null = null;
  let status = "open";

  if (input.asPaymentLink) {
    const link = await mollieCreatePaymentLink(access.auth, {
      amount,
      description: input.description,
      redirectUrl: input.redirectUrl,
      webhookUrl: guestWebhookUrl(),
      ...(access.profileId ? { profileId: access.profileId } : {}),
      ...(fee ?? {}),
    });
    if (!link.ok) {
      return {
        ok: false,
        error: link.detail || "payment_link_failed",
        status: 502,
      };
    }
    molliePaymentLinkId = link.data.id;
    checkoutUrl = link.data._links?.paymentLink?.href ?? null;
  } else {
    const payment = await mollieCreatePayment(access.auth, {
      amount,
      description: input.description,
      redirectUrl: input.redirectUrl,
      ...(input.cancelUrl ? { cancelUrl: input.cancelUrl } : {}),
      webhookUrl: guestWebhookUrl(),
      ...(access.profileId ? { profileId: access.profileId } : {}),
      metadata,
      ...(fee ?? {}),
    });
    if (!payment.ok) {
      return {
        ok: false,
        error: payment.detail || "payment_create_failed",
        status: 502,
      };
    }
    molliePaymentId = payment.data.id;
    checkoutUrl = payment.data._links?.checkout?.href ?? null;
    status = mapMolliePaymentStatusToGuest(payment.data.status);
  }

  const { data, error } = await admin
    .from("restaurant_guest_payments")
    .insert({
      restaurant_id: input.restaurantId,
      purpose,
      amount_value: amount.value,
      amount_currency: amount.currency,
      description: input.description,
      status,
      mollie_payment_id: molliePaymentId,
      mollie_payment_link_id: molliePaymentLinkId,
      checkout_url: checkoutUrl,
      metadata,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    return { ok: false, error: "db_insert_failed", status: 500 };
  }

  return {
    ok: true,
    id: data.id as string,
    checkoutUrl,
    molliePaymentId,
    molliePaymentLinkId,
  };
}

export async function syncGuestPaymentFromMollie(
  paymentId: string,
): Promise<{ processed: boolean }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { processed: false };

  const { data: row } = await admin
    .from("restaurant_guest_payments")
    .select("id, restaurant_id")
    .eq("mollie_payment_id", paymentId)
    .maybeSingle();

  if (!row?.restaurant_id) {
    // Still try to ack — may be POS routed elsewhere
    return { processed: false };
  }

  const access = await getRestaurantMollieAccess(row.restaurant_id as string);
  if (!access.ok) return { processed: false };

  const payment = await mollieGetPayment(access.auth, paymentId);
  if (!payment.ok) return { processed: false };

  const status = mapMolliePaymentStatusToGuest(payment.data.status);
  await admin
    .from("restaurant_guest_payments")
    .update({
      status,
      paid_at: payment.data.paidAt ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id as string);

  if (status === "paid") {
    try {
      const { markGuestOrderPaidFromPayment } = await import(
        "@/lib/ordering/create-guest-order-server"
      );
      await markGuestOrderPaidFromPayment(paymentId);
    } catch (err) {
      console.warn(
        "[mollie] mark guest order paid",
        err instanceof Error ? err.message : err,
      );
    }
  }

  return { processed: true };
}

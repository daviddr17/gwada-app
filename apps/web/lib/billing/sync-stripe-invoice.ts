import "server-only";

import type Stripe from "stripe";
import {
  findRestaurantIdByStripeCustomer,
  findRestaurantIdByStripeSubscription,
} from "@/lib/billing/subscription-db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function unixToIso(sec: number | null | undefined): string | null {
  if (!sec) return null;
  return new Date(sec * 1000).toISOString();
}

function mapInvoiceStatus(
  invoice: Stripe.Invoice,
  eventHint?: "payment_failed",
): string {
  if (eventHint === "payment_failed") return "payment_failed";
  const status = invoice.status ?? "open";
  if (
    status === "draft" ||
    status === "open" ||
    status === "paid" ||
    status === "uncollectible" ||
    status === "void"
  ) {
    return status;
  }
  return "open";
}

export async function syncStripeInvoiceToDb(
  invoice: Stripe.Invoice,
  options?: { eventHint?: "payment_failed"; restaurantIdHint?: string | null },
): Promise<{ ok: true; restaurantId: string | null } | { ok: false; error: string }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "admin_unavailable" };

  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer &&
          typeof invoice.customer === "object" &&
          "id" in invoice.customer
        ? invoice.customer.id
        : null;
  const parentSub = invoice.parent?.subscription_details?.subscription;
  const subscriptionId =
    typeof parentSub === "string"
      ? parentSub
      : parentSub && typeof parentSub === "object" && "id" in parentSub
        ? parentSub.id
        : null;

  let restaurantId: string | null =
    (typeof options?.restaurantIdHint === "string"
      ? options.restaurantIdHint
      : null) ??
    (typeof invoice.metadata?.restaurant_id === "string"
      ? invoice.metadata.restaurant_id
      : null);
  if (!restaurantId && subscriptionId) {
    restaurantId = await findRestaurantIdByStripeSubscription(subscriptionId);
  }
  if (!restaurantId && customerId) {
    restaurantId = await findRestaurantIdByStripeCustomer(customerId);
  }

  const paidAt =
    invoice.status_transitions?.paid_at != null
      ? unixToIso(invoice.status_transitions.paid_at)
      : invoice.status === "paid"
        ? unixToIso(invoice.created)
        : null;

  const row = {
    restaurant_id: restaurantId,
    stripe_invoice_id: invoice.id,
    number: invoice.number ?? null,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    status: mapInvoiceStatus(invoice, options?.eventHint),
    billing_reason: invoice.billing_reason ?? null,
    currency: (invoice.currency ?? "eur").toLowerCase(),
    amount_due: invoice.amount_due ?? 0,
    amount_paid: invoice.amount_paid ?? 0,
    amount_remaining: invoice.amount_remaining ?? 0,
    period_start: unixToIso(invoice.period_start),
    period_end: unixToIso(invoice.period_end),
    paid_at: paidAt,
    hosted_invoice_url: invoice.hosted_invoice_url ?? null,
    invoice_pdf: invoice.invoice_pdf ?? null,
    stripe_created_at: unixToIso(invoice.created) ?? new Date().toISOString(),
    synced_at: new Date().toISOString(),
  };

  const { error } = await admin
    .from("restaurant_billing_invoices")
    .upsert(row, { onConflict: "stripe_invoice_id" });

  if (error && /'?number'?/.test(error.message)) {
    const { number: _number, ...withoutNumber } = row;
    const retry = await admin
      .from("restaurant_billing_invoices")
      .upsert(withoutNumber, { onConflict: "stripe_invoice_id" });
    if (retry.error) return { ok: false, error: retry.error.message };
    return { ok: true, restaurantId };
  }

  if (error) return { ok: false, error: error.message };
  return { ok: true, restaurantId };
}

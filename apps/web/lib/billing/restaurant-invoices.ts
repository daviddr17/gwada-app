import "server-only";

import { createStripeClient } from "@/lib/billing/stripe-server";
import { syncStripeInvoiceToDb } from "@/lib/billing/sync-stripe-invoice";
import { loadRestaurantEntitlements } from "@/lib/billing/subscription-db";
import type { RestaurantBillingInvoiceDto } from "@/lib/billing/restaurant-invoice-types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type { RestaurantBillingInvoiceDto } from "@/lib/billing/restaurant-invoice-types";

function mapRow(raw: Record<string, unknown>): RestaurantBillingInvoiceDto {
  return {
    id: String(raw.id),
    number: (raw.number as string | null) ?? null,
    status: String(raw.status),
    billingReason: (raw.billing_reason as string | null) ?? null,
    currency: String(raw.currency ?? "eur"),
    amountDue: Number(raw.amount_due ?? 0),
    amountPaid: Number(raw.amount_paid ?? 0),
    periodStart: (raw.period_start as string | null) ?? null,
    periodEnd: (raw.period_end as string | null) ?? null,
    paidAt: (raw.paid_at as string | null) ?? null,
    hostedInvoiceUrl: (raw.hosted_invoice_url as string | null) ?? null,
    invoicePdf: (raw.invoice_pdf as string | null) ?? null,
    createdAt: String(raw.stripe_created_at),
  };
}

export async function listRestaurantBillingInvoices(
  restaurantId: string,
): Promise<RestaurantBillingInvoiceDto[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];

  const { data, error } = await admin
    .from("restaurant_billing_invoices")
    .select(
      "id, number, status, billing_reason, currency, amount_due, amount_paid, period_start, period_end, paid_at, hosted_invoice_url, invoice_pdf, stripe_created_at",
    )
    .eq("restaurant_id", restaurantId)
    .order("stripe_created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.warn("listRestaurantBillingInvoices", error.message);
    return [];
  }
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function refreshRestaurantBillingInvoicesFromStripe(
  restaurantId: string,
): Promise<{ synced: number; failed: number }> {
  const entitlements = await loadRestaurantEntitlements(restaurantId);
  const customerId = entitlements.stripeCustomerId;
  if (!customerId) return { synced: 0, failed: 0 };

  const client = await createStripeClient();
  if (!client) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;
  const list = await client.stripe.invoices.list({
    customer: customerId,
    limit: 40,
  });
  for (const invoice of list.data) {
    const result = await syncStripeInvoiceToDb(invoice, {
      restaurantIdHint: restaurantId,
    });
    if (result.ok) synced += 1;
    else failed += 1;
  }
  return { synced, failed };
}

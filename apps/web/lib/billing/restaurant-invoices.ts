import "server-only";

import { loadRestaurantEntitlements } from "@/lib/billing/subscription-db";
import type { RestaurantBillingInvoiceDto } from "@/lib/billing/restaurant-invoice-types";
import { getPublicSiteUrl } from "@/lib/public-env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type { RestaurantBillingInvoiceDto } from "@/lib/billing/restaurant-invoice-types";

function invoicePdfPath(restaurantId: string, invoiceId: string): string {
  const site = (getPublicSiteUrl() || "").replace(/\/$/, "");
  const path = `/api/billing/invoices/${encodeURIComponent(invoiceId)}/pdf?restaurantId=${encodeURIComponent(restaurantId)}`;
  return site ? `${site}${path}` : path;
}

function mapRow(
  raw: Record<string, unknown>,
  restaurantId: string,
): RestaurantBillingInvoiceDto {
  const id = String(raw.id);
  const fallbackUrl = invoicePdfPath(restaurantId, id);
  return {
    id,
    number: (raw.number as string | null) ?? null,
    status: String(raw.status),
    billingReason: (raw.billing_reason as string | null) ?? null,
    currency: String(raw.currency ?? "eur"),
    amountDue: Number(raw.amount_due ?? 0),
    amountPaid: Number(raw.amount_paid ?? 0),
    periodStart: (raw.period_start as string | null) ?? null,
    periodEnd: (raw.period_end as string | null) ?? null,
    paidAt: (raw.paid_at as string | null) ?? null,
    hostedInvoiceUrl:
      (raw.hosted_invoice_url as string | null)?.trim() || fallbackUrl,
    invoicePdf: (raw.invoice_pdf as string | null)?.trim() || fallbackUrl,
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
  return (data ?? []).map((row) =>
    mapRow(row as Record<string, unknown>, restaurantId),
  );
}

export async function loadRestaurantBillingInvoiceForPdf(input: {
  restaurantId: string;
  invoiceId: string;
}): Promise<{
  id: string;
  number: string | null;
  status: string;
  billingReason: string | null;
  currency: string;
  amountDue: number;
  amountPaid: number;
  periodStart: string | null;
  periodEnd: string | null;
  paidAt: string | null;
  createdAt: string;
  molliePaymentId: string | null;
} | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from("restaurant_billing_invoices")
    .select(
      "id, number, status, billing_reason, currency, amount_due, amount_paid, period_start, period_end, paid_at, stripe_created_at, mollie_payment_id, restaurant_id",
    )
    .eq("id", input.invoiceId)
    .eq("restaurant_id", input.restaurantId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: String(data.id),
    number: (data.number as string | null) ?? null,
    status: String(data.status),
    billingReason: (data.billing_reason as string | null) ?? null,
    currency: String(data.currency ?? "eur"),
    amountDue: Number(data.amount_due ?? 0),
    amountPaid: Number(data.amount_paid ?? 0),
    periodStart: (data.period_start as string | null) ?? null,
    periodEnd: (data.period_end as string | null) ?? null,
    paidAt: (data.paid_at as string | null) ?? null,
    createdAt: String(data.stripe_created_at),
    molliePaymentId: (data.mollie_payment_id as string | null) ?? null,
  };
}

/** Mollie has no invoice list like Stripe — DB rows from webhooks are source of truth. */
export async function refreshRestaurantBillingInvoicesFromMollie(
  restaurantId: string,
): Promise<{ synced: number; failed: number }> {
  const entitlements = await loadRestaurantEntitlements(restaurantId);
  if (!entitlements.mollieCustomerId) return { synced: 0, failed: 0 };
  const rows = await listRestaurantBillingInvoices(restaurantId);
  return { synced: rows.length, failed: 0 };
}

/** @deprecated */
export const refreshRestaurantBillingInvoicesFromStripe =
  refreshRestaurantBillingInvoicesFromMollie;

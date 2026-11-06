import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { MolliePayment } from "@/lib/mollie/mollie-payments";
import { parseMollieAmountValue } from "@/lib/mollie/mollie-amount";
import {
  isBillingInterval,
  type BillingInterval,
} from "@/lib/billing/plan-catalog";
import { getPublicSiteUrl } from "@/lib/public-env";

function invoiceStatusFromPayment(status: string): string {
  switch (status) {
    case "paid":
      return "paid";
    case "failed":
      return "payment_failed";
    case "expired":
    case "canceled":
      return "void";
    case "authorized":
    case "pending":
    case "open":
      return "open";
    default:
      return "open";
  }
}

function billingReasonFromPayment(payment: MolliePayment): string {
  const purpose = payment.metadata?.purpose?.trim();
  if (purpose === "billing_first") return "subscription_create";
  if (purpose === "billing_proration") return "subscription_update";
  if (purpose === "billing_update_mandate") return "payment_method_update";
  if (payment.subscriptionId) return "subscription_cycle";
  return "subscription";
}

function invoiceNumberFromPayment(payment: MolliePayment): string {
  const short = payment.id.replace(/^tr_/, "").slice(0, 10).toUpperCase();
  return `GWA-${short}`;
}

function periodBoundsFromPayment(payment: MolliePayment): {
  periodStart: string | null;
  periodEnd: string | null;
} {
  const meta = payment.metadata ?? {};
  const periodEndMeta = meta.period_end?.trim();
  const periodStartMeta = meta.period_start?.trim();
  if (periodEndMeta || periodStartMeta) {
    return {
      periodStart: periodStartMeta || null,
      periodEnd: periodEndMeta || null,
    };
  }

  const paidAt = payment.paidAt ?? null;
  if (!paidAt) return { periodStart: null, periodEnd: null };

  const intervalRaw = meta.interval ?? "month";
  const interval: BillingInterval = isBillingInterval(intervalRaw)
    ? intervalRaw
    : "month";
  const start = new Date(paidAt);
  const end = new Date(paidAt);
  if (interval === "year") end.setUTCFullYear(end.getUTCFullYear() + 1);
  else end.setUTCMonth(end.getUTCMonth() + 1);

  // For renewals, paidAt is closer to period start of the new cycle.
  return {
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
  };
}

function invoicePublicUrls(
  restaurantId: string,
  invoiceId: string,
): { hosted: string; pdf: string } {
  const site = (getPublicSiteUrl() || "https://gwada.app").replace(/\/$/, "");
  const path = `/api/billing/invoices/${encodeURIComponent(invoiceId)}/pdf?restaurantId=${encodeURIComponent(restaurantId)}`;
  return { hosted: `${site}${path}`, pdf: `${site}${path}` };
}

export async function syncMolliePaymentInvoiceToDb(
  payment: MolliePayment,
  restaurantId: string,
): Promise<{ ok: true; invoiceId?: string } | { ok: false; error: string }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "server_misconfigured" };

  const amountCents = Math.round(
    parseMollieAmountValue(payment.amount.value) * 100,
  );
  const currency = (payment.amount.currency || "EUR").toLowerCase();
  const status = invoiceStatusFromPayment(payment.status);
  const paidAt = payment.paidAt ?? null;
  const number = invoiceNumberFromPayment(payment);
  const billingReason = billingReasonFromPayment(payment);
  const { periodStart, periodEnd } = periodBoundsFromPayment(payment);

  const existing = await admin
    .from("restaurant_billing_invoices")
    .select("id")
    .eq("mollie_payment_id", payment.id)
    .maybeSingle();

  if (existing.data?.id) {
    const invoiceId = existing.data.id as string;
    const urls = invoicePublicUrls(restaurantId, invoiceId);
    const { error } = await admin
      .from("restaurant_billing_invoices")
      .update({
        status,
        number,
        billing_reason: billingReason,
        amount_due: amountCents,
        amount_paid: status === "paid" ? amountCents : 0,
        amount_remaining: status === "paid" ? 0 : amountCents,
        period_start: periodStart,
        period_end: periodEnd,
        paid_at: paidAt,
        hosted_invoice_url: urls.hosted,
        invoice_pdf: urls.pdf,
        synced_at: new Date().toISOString(),
      })
      .eq("id", invoiceId);
    if (error) return { ok: false, error: error.message };
    return { ok: true, invoiceId };
  }

  // Insert first without URLs (need id), then patch URLs.
  const { data: inserted, error } = await admin
    .from("restaurant_billing_invoices")
    .insert({
      restaurant_id: restaurantId,
      mollie_payment_id: payment.id,
      stripe_invoice_id: null,
      stripe_subscription_id: payment.subscriptionId ?? null,
      number,
      status,
      billing_reason: billingReason,
      currency,
      amount_due: amountCents,
      amount_paid: status === "paid" ? amountCents : 0,
      amount_remaining: status === "paid" ? 0 : amountCents,
      period_start: periodStart,
      period_end: periodEnd,
      paid_at: paidAt,
      stripe_created_at: paidAt ?? new Date().toISOString(),
      synced_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  const invoiceId = inserted?.id as string | undefined;
  if (!invoiceId) return { ok: true };

  const urls = invoicePublicUrls(restaurantId, invoiceId);
  await admin
    .from("restaurant_billing_invoices")
    .update({
      hosted_invoice_url: urls.hosted,
      invoice_pdf: urls.pdf,
      synced_at: new Date().toISOString(),
    })
    .eq("id", invoiceId);

  return { ok: true, invoiceId };
}

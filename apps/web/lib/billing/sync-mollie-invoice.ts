import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { MolliePayment } from "@/lib/mollie/mollie-payments";
import { parseMollieAmountValue } from "@/lib/mollie/mollie-amount";

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

export async function syncMolliePaymentInvoiceToDb(
  payment: MolliePayment,
  restaurantId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "server_misconfigured" };

  const amountCents = Math.round(
    parseMollieAmountValue(payment.amount.value) * 100,
  );
  const currency = (payment.amount.currency || "EUR").toLowerCase();
  const status = invoiceStatusFromPayment(payment.status);
  const paidAt = payment.paidAt ?? null;

  const existing = await admin
    .from("restaurant_billing_invoices")
    .select("id")
    .eq("mollie_payment_id", payment.id)
    .maybeSingle();

  if (existing.data?.id) {
    const { error } = await admin
      .from("restaurant_billing_invoices")
      .update({
        status,
        amount_due: amountCents,
        amount_paid: status === "paid" ? amountCents : 0,
        amount_remaining: status === "paid" ? 0 : amountCents,
        paid_at: paidAt,
        synced_at: new Date().toISOString(),
      })
      .eq("id", existing.data.id as string);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  const { error } = await admin.from("restaurant_billing_invoices").insert({
    restaurant_id: restaurantId,
    mollie_payment_id: payment.id,
    stripe_invoice_id: null,
    stripe_subscription_id: payment.subscriptionId ?? null,
    status,
    currency,
    amount_due: amountCents,
    amount_paid: status === "paid" ? amountCents : 0,
    amount_remaining: status === "paid" ? 0 : amountCents,
    paid_at: paidAt,
    stripe_created_at: paidAt ?? new Date().toISOString(),
    synced_at: new Date().toISOString(),
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

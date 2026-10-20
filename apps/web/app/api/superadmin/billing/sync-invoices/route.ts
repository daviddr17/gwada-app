import { listMollieLinkedSubscriptions } from "@/lib/billing/subscription-db";
import { assertSuperadminApi } from "@/lib/superadmin/assert-superadmin-api";

export const dynamic = "force-dynamic";

/**
 * Mollie invoices are written by webhooks into restaurant_billing_invoices.
 * This endpoint reports how many Mollie-linked subscriptions exist (no Stripe pull).
 */
export async function POST() {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const linked = await listMollieLinkedSubscriptions();
  return Response.json({
    synced: 0,
    failed: 0,
    mollieSubscriptions: linked.length,
    note: "Rechnungen kommen über /api/billing/mollie/webhook",
  });
}

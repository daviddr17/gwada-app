import { syncStripeInvoiceToDb } from "@/lib/billing/sync-stripe-invoice";
import { createStripeClient } from "@/lib/billing/stripe-server";
import { assertSuperadminApi } from "@/lib/superadmin/assert-superadmin-api";

export const dynamic = "force-dynamic";

/** Pull recent Stripe invoices into restaurant_billing_invoices. */
export async function POST() {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const client = await createStripeClient();
  if (!client) {
    return Response.json({ error: "stripe_not_configured" }, { status: 503 });
  }

  let synced = 0;
  let failed = 0;
  let startingAfter: string | undefined;

  for (let page = 0; page < 5; page += 1) {
    const list = await client.stripe.invoices.list({
      limit: 100,
      starting_after: startingAfter,
      expand: ["data.customer"],
    });

    for (const invoice of list.data) {
      const result = await syncStripeInvoiceToDb(invoice);
      if (result.ok) synced += 1;
      else failed += 1;
    }

    if (!list.has_more || list.data.length === 0) break;
    startingAfter = list.data[list.data.length - 1]?.id;
    if (!startingAfter) break;
  }

  return Response.json({ synced, failed });
}

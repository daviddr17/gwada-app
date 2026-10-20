import { processMollieBillingPaymentId } from "@/lib/billing/process-mollie-billing-webhook";

export const dynamic = "force-dynamic";

/**
 * Classic Mollie webhook: body is application/x-www-form-urlencoded with `id`.
 * Always fetch the payment via API — never trust status from the webhook payload.
 * Unknown ids still return 200 (Mollie docs).
 */
export async function POST(req: Request) {
  let paymentId: string | null = null;
  const contentType = req.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      const body = (await req.json()) as { id?: string };
      paymentId = typeof body.id === "string" ? body.id : null;
    } else {
      const form = await req.formData();
      const id = form.get("id");
      paymentId = typeof id === "string" ? id : null;
    }
  } catch {
    return new Response("ok", { status: 200 });
  }

  if (!paymentId?.startsWith("tr_")) {
    return new Response("ok", { status: 200 });
  }

  try {
    await processMollieBillingPaymentId(paymentId);
  } catch (err) {
    console.warn(
      "mollie billing webhook",
      err instanceof Error ? err.message : err,
    );
    return new Response("error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}

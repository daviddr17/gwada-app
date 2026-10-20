import { processPosMollieWebhook } from "@/lib/pos/mollie-pos-payment";
import { posJson } from "@/lib/pos/pos-responses";

export const dynamic = "force-dynamic";

/** Mollie POS webhook — fetch payment status via API (classic id payload). */
export async function POST(request: Request) {
  let paymentId: string | null = null;
  const contentType = request.headers.get("content-type") || "";
  try {
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as { id?: string };
      paymentId = typeof body.id === "string" ? body.id : null;
    } else {
      const form = await request.formData();
      const id = form.get("id");
      paymentId = typeof id === "string" ? id : null;
    }
  } catch {
    return posJson({ ok: true, processed: false });
  }

  if (!paymentId?.startsWith("tr_")) {
    return posJson({ ok: true, processed: false });
  }

  try {
    const result = await processPosMollieWebhook(paymentId);
    return posJson({ ok: true, processed: result.processed });
  } catch (err) {
    console.warn(
      "pos mollie webhook",
      err instanceof Error ? err.message : err,
    );
    return new Response("error", { status: 500 });
  }
}

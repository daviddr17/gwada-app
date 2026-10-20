import { syncGuestPaymentFromMollie } from "@/lib/payments/create-guest-payment";

export const dynamic = "force-dynamic";

/** Guest → restaurant Mollie webhook (classic id-only payload). */
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
    await syncGuestPaymentFromMollie(paymentId);
  } catch (err) {
    console.warn(
      "mollie guest webhook",
      err instanceof Error ? err.message : err,
    );
    return new Response("error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}

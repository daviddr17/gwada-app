import { syncMolliePaymentStatus } from "@/lib/pos/mollie-payment-server";
import { posJson } from "@/lib/pos/pos-responses";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  let molliePaymentId = (form?.get("id") as string | null)?.trim() ?? "";

  if (!molliePaymentId) {
    try {
      const json = (await request.json()) as { id?: string };
      molliePaymentId = json.id?.trim() ?? "";
    } catch {
      // ignore
    }
  }

  if (!molliePaymentId) {
    return posJson({ ok: true, processed: false, reason: "missing_id" });
  }

  try {
    const result = await syncMolliePaymentStatus({ molliePaymentId });
    if (!result.ok) {
      return posJson({ ok: true, processed: false, reason: result.error });
    }
    return posJson({ ok: true, processed: true, status: result.status });
  } catch (err) {
    console.warn("[mollie] webhook", err);
    return posJson({ ok: true, processed: false, reason: "handler_error" });
  }
}

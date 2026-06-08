import { payPosOrderCash } from "@/lib/pos/pos-order-server";
import { runPosPaymentPipeline } from "@/lib/pos/pos-payment-pipeline";
import { loadPosOrderDto, posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

type CollectCashBody = {
  tipCents?: number;
  receivedAmountCents?: number | null;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await context.params;
  const restaurantId =
    new URL(request.url).searchParams.get("restaurantId")?.trim() ?? "";

  if (!isUuidRestaurantId(restaurantId)) {
    return posError("invalid_restaurant_id", 400);
  }

  const authResult = await authorizePosRestaurant(request, restaurantId);
  if (!authResult.ok) {
    return posError(authResult.error, authResult.status);
  }

  let body: CollectCashBody = {};
  try {
    const raw = await request.text();
    if (raw.trim()) {
      body = JSON.parse(raw) as CollectCashBody;
    }
  } catch {
    return posError("invalid_request", 400);
  }

  const payResult = await payPosOrderCash({
    supabase: authResult.auth.supabase,
    restaurantId: authResult.auth.restaurantId,
    orderId,
    tipCents: body.tipCents,
    receivedAmountCents: body.receivedAmountCents,
  });

  if (!payResult.ok) {
    return posError(payResult.error, payResult.status);
  }

  const pipeline = await runPosPaymentPipeline(orderId);
  if (!pipeline.ok) {
    return posError(pipeline.error, 500);
  }

  const order = await loadPosOrderDto(authResult.auth.supabase, orderId);
  return posJson({ paymentId: payResult.paymentId, order });
}

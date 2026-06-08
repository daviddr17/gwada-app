import { posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

type CashReceivedBody = {
  receivedAmountCents?: number;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: paymentId } = await context.params;
  const restaurantId =
    new URL(request.url).searchParams.get("restaurantId")?.trim() ?? "";

  if (!isUuidRestaurantId(restaurantId)) {
    return posError("invalid_restaurant_id", 400);
  }

  const authResult = await authorizePosRestaurant(request, restaurantId);
  if (!authResult.ok) {
    return posError(authResult.error, authResult.status);
  }

  let body: CashReceivedBody;
  try {
    body = (await request.json()) as CashReceivedBody;
  } catch {
    return posError("invalid_request", 400);
  }

  const receivedAmountCents = body.receivedAmountCents;
  if (
    receivedAmountCents == null ||
    !Number.isFinite(receivedAmountCents) ||
    receivedAmountCents < 0
  ) {
    return posError("invalid_received_amount", 400);
  }

  const { data: payment, error: loadError } = await authResult.auth.supabase
    .from("pos_payments")
    .select("id, restaurant_id, method, status")
    .eq("id", paymentId)
    .maybeSingle();

  if (loadError || !payment) {
    return posError("payment_not_found", 404);
  }

  if (payment.restaurant_id !== authResult.auth.restaurantId) {
    return posError("forbidden", 403);
  }

  if (payment.method !== "cash") {
    return posError("not_cash_payment", 400);
  }

  const { error: updateError } = await authResult.auth.supabase
    .from("pos_payments")
    .update({ received_amount_cents: Math.round(receivedAmountCents) })
    .eq("id", paymentId);

  if (updateError) {
    return posError("update_failed", 500);
  }

  return posJson({ ok: true });
}

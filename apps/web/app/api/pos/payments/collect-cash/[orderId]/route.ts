import { openLineQuantity } from "@gwada/pos-domain";
import {
  collectCashAllocations,
} from "@/lib/pos/pos-session-settlement-server";
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

  const order = await loadPosOrderDto(authResult.auth.supabase, orderId);
  if (!order) {
    return posError("order_not_found", 404);
  }

  const allocations = order.lines
    .map((line) => ({
      orderLineId: line.id,
      quantity: line.openQuantity ?? openLineQuantity(line.quantity, line.paidQuantity ?? 0),
    }))
    .filter((a) => a.quantity > 0);

  if (allocations.length === 0) {
    return posError("order_already_paid", 400);
  }

  const result = await collectCashAllocations({
    supabase: authResult.auth.supabase,
    restaurantId: authResult.auth.restaurantId,
    tableSessionId: order.tableSessionId,
    allocations,
    tipCents: body.tipCents,
    receivedAmountCents: body.receivedAmountCents,
  });

  if (!result.ok) {
    return posError(result.error, result.status);
  }

  const updatedOrder = await loadPosOrderDto(authResult.auth.supabase, orderId);
  return posJson({ paymentId: result.paymentId, order: updatedOrder });
}

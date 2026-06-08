import { POS_ORDER_STATUSES, type PosOrderStatus } from "@gwada/pos-domain";
import { updatePosOrderStatus } from "@/lib/pos/pos-order-server";
import { loadPosOrderDto, posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

type StatusBody = {
  status?: PosOrderStatus;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: orderId } = await context.params;
  const restaurantId =
    new URL(request.url).searchParams.get("restaurantId")?.trim() ?? "";

  if (!isUuidRestaurantId(restaurantId)) {
    return posError("invalid_restaurant_id", 400);
  }

  const authResult = await authorizePosRestaurant(request, restaurantId);
  if (!authResult.ok) {
    return posError(authResult.error, authResult.status);
  }

  let body: StatusBody;
  try {
    body = (await request.json()) as StatusBody;
  } catch {
    return posError("invalid_request", 400);
  }

  const status = body.status;
  if (!status || !POS_ORDER_STATUSES.includes(status)) {
    return posError("invalid_status", 400);
  }

  const result = await updatePosOrderStatus({
    supabase: authResult.auth.supabase,
    restaurantId: authResult.auth.restaurantId,
    orderId,
    status,
  });

  if (!result.ok) {
    return posError(result.error, result.status);
  }

  const order = await loadPosOrderDto(authResult.auth.supabase, orderId);
  return posJson({ order });
}

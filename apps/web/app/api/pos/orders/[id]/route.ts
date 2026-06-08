import { loadPosOrderDto, posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function GET(
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

  const order = await loadPosOrderDto(authResult.auth.supabase, orderId);
  if (!order) {
    return posError("order_not_found", 404);
  }

  if (order.restaurantId !== authResult.auth.restaurantId) {
    return posError("forbidden", 403);
  }

  return posJson({ order });
}

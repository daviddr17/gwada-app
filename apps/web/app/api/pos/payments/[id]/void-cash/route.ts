import { voidCashPayment } from "@/lib/pos/pos-void-cash-server";
import { posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: paymentId } = await context.params;

  let body: { restaurantId?: string; reopenTable?: boolean };
  try {
    body = (await request.json()) as {
      restaurantId?: string;
      reopenTable?: boolean;
    };
  } catch {
    return posError("invalid_request", 400);
  }

  const restaurantId = body.restaurantId?.trim() ?? "";
  if (!isUuidRestaurantId(restaurantId) || !isUuidRestaurantId(paymentId)) {
    return posError("invalid_id", 400);
  }

  const authResult = await authorizePosRestaurant(request, restaurantId);
  if (!authResult.ok) return posError(authResult.error, authResult.status);

  const result = await voidCashPayment({
    supabase: authResult.auth.supabase,
    restaurantId: authResult.auth.restaurantId,
    paymentId,
    reopenTable: body.reopenTable !== false,
  });

  if (!result.ok) return posError(result.error, result.status);
  return posJson(result);
}

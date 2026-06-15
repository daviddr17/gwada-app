import { syncMolliePaymentStatus } from "@/lib/pos/mollie-payment-server";
import { posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ molliePaymentId: string }> },
) {
  const { molliePaymentId } = await context.params;
  const restaurantId =
    new URL(request.url).searchParams.get("restaurantId")?.trim() ?? "";

  const authResult = await authorizePosRestaurant(request, restaurantId);
  if (!authResult.ok) {
    return posError(authResult.error, authResult.status);
  }

  const result = await syncMolliePaymentStatus({
    restaurantId: authResult.auth.restaurantId,
    molliePaymentId,
  });

  if (!result.ok) {
    return posError(result.error, 502);
  }

  return posJson({ status: result.status, posPaymentId: result.posPaymentId });
}

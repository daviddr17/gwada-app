import { posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";
import { recheckMolliePosPayment } from "@/lib/pos/mollie-pos-payment";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ molliePaymentId: string }> },
) {
  const { molliePaymentId } = await context.params;
  const restaurantId =
    new URL(request.url).searchParams.get("restaurantId")?.trim() ?? null;

  const authResult = await authorizePosRestaurant(request, restaurantId);
  if (!authResult.ok) {
    return posError(authResult.error, authResult.status);
  }

  if (!molliePaymentId?.startsWith("tr_")) {
    return posError("invalid_request", 400);
  }

  const result = await recheckMolliePosPayment({
    restaurantId: authResult.auth.restaurantId,
    molliePaymentId,
  });

  if (!result.ok) {
    return posError(result.error, result.status);
  }

  return posJson({
    ok: true,
    status: result.status,
    paid: result.paid,
  });
}

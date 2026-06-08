import { posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";

export const dynamic = "force-dynamic";

/** Manual Mollie status recheck — Phase 2. */
export async function POST(
  request: Request,
  context: { params: Promise<{ molliePaymentId: string }> },
) {
  const { molliePaymentId: _molliePaymentId } = await context.params;
  const restaurantId =
    new URL(request.url).searchParams.get("restaurantId")?.trim() ?? null;

  const authResult = await authorizePosRestaurant(request, restaurantId);
  if (!authResult.ok) {
    return posError(authResult.error, authResult.status);
  }

  return posError("mollie_not_implemented", 501);
}

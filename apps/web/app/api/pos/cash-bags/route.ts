import { listOpenWaiterCashBags } from "@/lib/pos/waiter-cash-bag-server";
import { posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const restaurantId = url.searchParams.get("restaurantId");
  const status = url.searchParams.get("status")?.trim() || "open";

  const auth = await authorizePosRestaurant(request, restaurantId);
  if (!auth.ok) {
    return posError(auth.error, auth.status);
  }

  if (status !== "open") {
    return posError("unsupported_status", 400);
  }

  const result = await listOpenWaiterCashBags({
    restaurantId: auth.auth.restaurantId,
  });

  if (!result.ok) {
    return posError(result.error, result.status);
  }

  return posJson(result);
}

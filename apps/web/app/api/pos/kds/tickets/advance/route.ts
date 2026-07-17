import { advanceKdsTicketStatus } from "@/lib/pos/pos-kds-server";
import { posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: {
    restaurantId?: string;
    orderId?: string;
    deviceId?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return posError("invalid_request", 400);
  }

  const orderId = body.orderId?.trim() ?? "";
  if (!orderId) return posError("invalid_order", 400);

  const authResult = await authorizePosRestaurant(
    request,
    body.restaurantId ?? null,
  );
  if (!authResult.ok) return posError(authResult.error, authResult.status);

  const result = await advanceKdsTicketStatus({
    supabase: authResult.auth.supabase,
    restaurantId: authResult.auth.restaurantId,
    orderId,
    deviceId: body.deviceId?.trim() || null,
  });

  if (!result.ok) return posError(result.error, result.status);
  return posJson(result);
}

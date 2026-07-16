import { movePosOrderLines } from "@/lib/pos/pos-move-lines-server";
import { posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";

export const dynamic = "force-dynamic";

type Body = {
  restaurantId?: string;
  targetTableSessionId?: string;
  lineMoves?: Array<{ orderLineId?: string; quantity?: number }>;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return posError("invalid_request", 400);
  }

  const authResult = await authorizePosRestaurant(request, body.restaurantId ?? null);
  if (!authResult.ok) {
    return posError(authResult.error, authResult.status);
  }

  const targetTableSessionId = body.targetTableSessionId?.trim() ?? "";
  if (!targetTableSessionId) {
    return posError("invalid_target_session", 400);
  }

  const lineMoves = (body.lineMoves ?? [])
    .map((m) => ({
      orderLineId: m.orderLineId?.trim() ?? "",
      quantity: Number(m.quantity),
    }))
    .filter((m) => m.orderLineId && Number.isFinite(m.quantity));

  const result = await movePosOrderLines({
    supabase: authResult.auth.supabase,
    restaurantId: authResult.auth.restaurantId,
    targetTableSessionId,
    lineMoves,
    createdByProfileId: authResult.auth.userId,
  });

  if (!result.ok) {
    return posError(result.error, result.status);
  }

  return posJson({
    orderId: result.orderId,
    orderNumber: result.orderNumber,
  });
}

import { openPosTableSession } from "@/lib/pos/pos-order-server";
import { posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";

export const dynamic = "force-dynamic";

type OpenSessionBody = {
  restaurantId?: string;
  diningTableId?: string;
  coverCount?: number;
  reservationId?: string | null;
};

export async function POST(request: Request) {
  let body: OpenSessionBody;
  try {
    body = (await request.json()) as OpenSessionBody;
  } catch {
    return posError("invalid_request", 400);
  }

  const authResult = await authorizePosRestaurant(request, body.restaurantId ?? null);
  if (!authResult.ok) {
    return posError(authResult.error, authResult.status);
  }

  const diningTableId = body.diningTableId?.trim() ?? "";
  if (!diningTableId) {
    return posError("invalid_dining_table_id", 400);
  }

  const result = await openPosTableSession({
    supabase: authResult.auth.supabase,
    restaurantId: authResult.auth.restaurantId,
    diningTableId,
    coverCount: body.coverCount,
    openedByProfileId: authResult.auth.userId,
    reservationId: body.reservationId,
  });

  if (!result.ok) {
    return posError(result.error, result.status);
  }

  return posJson({ sessionId: result.sessionId });
}

import { seatPosReservation } from "@/lib/pos/pos-seat-reservation-server";
import { posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";

export const dynamic = "force-dynamic";

type SeatBody = {
  restaurantId?: string;
  reservationId?: string;
  diningTableId?: string;
  coverCount?: number;
  localSessionId?: string | null;
  idempotencyKey?: string | null;
};

export async function POST(request: Request) {
  let body: SeatBody;
  try {
    body = (await request.json()) as SeatBody;
  } catch {
    return posError("invalid_request", 400);
  }

  const authResult = await authorizePosRestaurant(request, body.restaurantId ?? null);
  if (!authResult.ok) {
    return posError(authResult.error, authResult.status);
  }

  const reservationId = body.reservationId?.trim() ?? "";
  const diningTableId = body.diningTableId?.trim() ?? "";
  if (!reservationId) {
    return posError("invalid_reservation_id", 400);
  }
  if (!diningTableId) {
    return posError("invalid_dining_table_id", 400);
  }

  const result = await seatPosReservation({
    supabase: authResult.auth.supabase,
    restaurantId: authResult.auth.restaurantId,
    reservationId,
    diningTableId,
    coverCount: body.coverCount,
    openedByProfileId: authResult.auth.userId,
    staffId: authResult.auth.staffId,
  });

  if (!result.ok) {
    return posError(result.error, result.status);
  }

  return posJson({ sessionId: result.sessionId });
}

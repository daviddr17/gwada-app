import {
  recordDeliveryLocation,
  startDeliveryTracking,
  stopDeliveryTracking,
} from "@/lib/ordering/delivery-tracking-server";
import { notifyGuestOrderStatusChange } from "@/lib/ordering/guest-order-notify-server";
import { posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";

export const dynamic = "force-dynamic";

type Body = {
  restaurantId?: string;
  action?: "start" | "ping" | "stop";
  lat?: number;
  lng?: number;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await context.params;
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return posError("invalid_request", 400);
  }

  const authResult = await authorizePosRestaurant(
    request,
    body.restaurantId ?? null,
  );
  if (!authResult.ok) return posError(authResult.error, authResult.status);

  const action = body.action ?? "ping";

  if (action === "start") {
    const result = await startDeliveryTracking({
      supabase: authResult.auth.supabase,
      restaurantId: authResult.auth.restaurantId,
      orderId,
    });
    if (!result.ok) return posError(result.error, result.status);
    void notifyGuestOrderStatusChange({
      orderId,
      status: "out_for_delivery",
    });
    return posJson({ ok: true });
  }

  if (action === "stop") {
    const result = await stopDeliveryTracking({
      supabase: authResult.auth.supabase,
      restaurantId: authResult.auth.restaurantId,
      orderId,
    });
    if (!result.ok) return posError(result.error, result.status);
    return posJson({ ok: true });
  }

  if (typeof body.lat !== "number" || typeof body.lng !== "number") {
    return posError("invalid_coordinates", 400);
  }

  const result = await recordDeliveryLocation({
    supabase: authResult.auth.supabase,
    restaurantId: authResult.auth.restaurantId,
    orderId,
    lat: body.lat,
    lng: body.lng,
    profileId: authResult.auth.userId,
  });
  if (!result.ok) return posError(result.error, result.status);
  return posJson({ ok: true });
}

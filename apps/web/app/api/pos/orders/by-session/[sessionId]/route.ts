import { loadPosOrdersForSession, posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;
  const restaurantId =
    new URL(request.url).searchParams.get("restaurantId")?.trim() ?? "";

  if (!isUuidRestaurantId(restaurantId)) {
    return posError("invalid_restaurant_id", 400);
  }

  const authResult = await authorizePosRestaurant(request, restaurantId);
  if (!authResult.ok) {
    return posError(authResult.error, authResult.status);
  }

  const { data: session, error } = await authResult.auth.supabase
    .from("pos_table_sessions")
    .select("id, restaurant_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (error || !session) {
    return posError("session_not_found", 404);
  }

  if (session.restaurant_id !== authResult.auth.restaurantId) {
    return posError("forbidden", 403);
  }

  const orders = await loadPosOrdersForSession(authResult.auth.supabase, sessionId);
  return posJson({ orders });
}

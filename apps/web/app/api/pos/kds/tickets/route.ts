import { loadKdsTickets } from "@/lib/pos/pos-kds-server";
import { posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const restaurantId = url.searchParams.get("restaurantId")?.trim() ?? "";
  const deviceId = url.searchParams.get("deviceId")?.trim() || null;

  const authResult = await authorizePosRestaurant(request, restaurantId);
  if (!authResult.ok) return posError(authResult.error, authResult.status);

  const result = await loadKdsTickets({
    supabase: authResult.auth.supabase,
    restaurantId: authResult.auth.restaurantId,
    deviceId,
  });

  return posJson(result);
}

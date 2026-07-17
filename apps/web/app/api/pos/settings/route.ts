import {
  getRestaurantPosSettings,
  upsertRestaurantPosSettings,
} from "@/lib/pos/pos-restaurant-settings-server";
import { posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const restaurantId =
    new URL(request.url).searchParams.get("restaurantId")?.trim() ?? "";
  const authResult = await authorizePosRestaurant(request, restaurantId);
  if (!authResult.ok) return posError(authResult.error, authResult.status);

  const settings = await getRestaurantPosSettings(
    authResult.auth.supabase,
    authResult.auth.restaurantId,
  );
  return posJson({ settings });
}

export async function POST(request: Request) {
  let body: {
    restaurantId?: string;
    inventoryBookingEnabled?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return posError("invalid_request", 400);
  }

  const authResult = await authorizePosRestaurant(
    request,
    body.restaurantId ?? null,
  );
  if (!authResult.ok) return posError(authResult.error, authResult.status);

  const settings = await upsertRestaurantPosSettings({
    supabase: authResult.auth.supabase,
    restaurantId: authResult.auth.restaurantId,
    inventoryBookingEnabled: body.inventoryBookingEnabled === true,
  });
  if (!settings) return posError("save_failed", 500);
  return posJson({ settings });
}

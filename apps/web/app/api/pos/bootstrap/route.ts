import { loadPosBootstrap } from "@/lib/pos/pos-bootstrap-server";
import { posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";

export const dynamic = "force-dynamic";

/**
 * Bootstrap für die iPad-Kasse: Floor, Speisekarte (+ Optionen), Register-Status.
 * Handgeräte holen denselben Stand lokal vom Hub — nicht direkt von hier.
 */
export async function GET(request: Request) {
  const restaurantId =
    new URL(request.url).searchParams.get("restaurantId")?.trim() ?? "";

  const authResult = await authorizePosRestaurant(request, restaurantId);
  if (!authResult.ok) {
    return posError(authResult.error, authResult.status);
  }

  const payload = await loadPosBootstrap(
    authResult.auth.supabase,
    authResult.auth.restaurantId,
  );

  if ("error" in payload) {
    return posError(payload.error, payload.status);
  }

  return posJson(payload);
}

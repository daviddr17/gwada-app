import { loadPosBootstrap } from "@/lib/pos/pos-bootstrap-server";
import { verifyPosDeviceToken } from "@/lib/pos/pos-capabilities-devices-server";
import { posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Bootstrap für die iPad-Kasse: Floor, Speisekarte (+ Optionen), Register-Status.
 * Auth: Staff-Bearer **oder** Device-Token (nach Einrichtungs-Code).
 */
export async function GET(request: Request) {
  const restaurantId =
    new URL(request.url).searchParams.get("restaurantId")?.trim() ?? "";

  const authResult = await authorizePosRestaurant(request, restaurantId);
  if (authResult.ok) {
    const payload = await loadPosBootstrap(
      authResult.auth.supabase,
      authResult.auth.restaurantId,
    );
    if ("error" in payload) {
      return posError(payload.error, payload.status);
    }
    return posJson(payload);
  }

  // Fallback: Hub nach Setup-Code (X-Pos-Device-Id + X-Pos-Device-Token)
  const admin = createSupabaseAdminClient();
  if (!admin) return posError(authResult.error, authResult.status);

  const deviceId = request.headers.get("x-pos-device-id")?.trim() ?? "";
  const deviceToken = request.headers.get("x-pos-device-token")?.trim() ?? "";
  const deviceAuth = await verifyPosDeviceToken({
    admin,
    deviceId,
    deviceToken,
    restaurantId,
  });
  if (!deviceAuth.ok) {
    return posError(authResult.error, authResult.status);
  }

  const payload = await loadPosBootstrap(admin, deviceAuth.restaurantId);
  if ("error" in payload) {
    return posError(payload.error, payload.status);
  }
  return posJson(payload);
}

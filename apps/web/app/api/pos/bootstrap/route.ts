import { loadPosBootstrap } from "@/lib/pos/pos-bootstrap-server";
import { verifyPosDeviceToken } from "@/lib/pos/pos-capabilities-devices-server";
import { posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Bootstrap für die iPad-Kasse / Cloud-Handgerät: Floor, Speisekarte (+ Optionen), Register-Status.
 * Auth: Staff-Bearer **oder** Device-Token (nach Einrichtungs-Code).
 * Query `menuRevision`: bei Gleichheit wird das Menü weggelassen (`menuUnchanged`).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const restaurantId = url.searchParams.get("restaurantId")?.trim() ?? "";
  const clientMenuRevision =
    url.searchParams.get("menuRevision")?.trim() ||
    request.headers.get("if-none-match")?.replaceAll('"', "").trim() ||
    null;

  const authResult = await authorizePosRestaurant(request, restaurantId);
  if (authResult.ok) {
    const payload = await loadPosBootstrap(
      authResult.auth.supabase,
      authResult.auth.restaurantId,
      { clientMenuRevision },
    );
    if ("error" in payload) {
      return posError(payload.error, payload.status);
    }
    return posJson(payload, {
      headers: {
        ETag: `"${payload.menuRevision}"`,
      },
    });
  }

  // Fallback: Hub/Handgerät nach Setup-Code (X-Pos-Device-Id + X-Pos-Device-Token)
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

  const payload = await loadPosBootstrap(admin, deviceAuth.restaurantId, {
    clientMenuRevision,
  });
  if ("error" in payload) {
    return posError(payload.error, payload.status);
  }
  return posJson(payload, {
    headers: {
      ETag: `"${payload.menuRevision}"`,
    },
  });
}

import {
  loadOnlineOrderingSettings,
  upsertOnlineOrderingSettings,
} from "@/lib/ordering/online-ordering-settings-server";
import type { OnlineOrderingSettingsPatch } from "@/lib/ordering/online-ordering-types";
import { posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const restaurantId =
    new URL(request.url).searchParams.get("restaurantId")?.trim() ?? "";
  const authResult = await authorizePosRestaurant(request, restaurantId);
  if (!authResult.ok) return posError(authResult.error, authResult.status);

  const settings = await loadOnlineOrderingSettings(
    authResult.auth.supabase,
    authResult.auth.restaurantId,
  );
  return posJson({ settings });
}

export async function PUT(request: Request) {
  let body: OnlineOrderingSettingsPatch & { restaurantId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return posError("invalid_request", 400);
  }

  const authResult = await authorizePosRestaurant(
    request,
    body.restaurantId ?? null,
  );
  if (!authResult.ok) return posError(authResult.error, authResult.status);

  const { restaurantId: _rid, ...patch } = body;
  const result = await upsertOnlineOrderingSettings(
    authResult.auth.supabase,
    authResult.auth.restaurantId,
    patch,
  );
  if (!result.ok) return posError(result.error, result.status);
  return posJson({ settings: result.settings });
}

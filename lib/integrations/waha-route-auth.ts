import { assertPlatformWhatsappEnabled } from "@/lib/integrations/platform-messaging-guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export type WahaRouteContext = {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  restaurantId: string;
};

export async function authorizeWahaRestaurantRoute(
  restaurantIdRaw: string | null,
): Promise<
  | { ok: true; ctx: WahaRouteContext }
  | { ok: false; status: number; error: string }
> {
  const restaurantId = restaurantIdRaw?.trim() ?? "";
  if (!isUuidRestaurantId(restaurantId)) {
    return { ok: false, status: 400, error: "invalid_restaurant_id" };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, status: 401, error: "unauthorized" };
  }

  const { data: allowed, error: rpcError } = await supabase.rpc(
    "auth_has_restaurant_permission",
    {
      p_restaurant_id: restaurantId,
      p_permission: "integrations.whatsapp",
    },
  );

  if (rpcError) {
    console.warn("auth_has_restaurant_permission", rpcError.message);
    return { ok: false, status: 403, error: "forbidden" };
  }

  if (!allowed) {
    return { ok: false, status: 403, error: "forbidden" };
  }

  const platform = await assertPlatformWhatsappEnabled(supabase);
  if (!platform.ok) {
    return { ok: false, status: 403, error: platform.error };
  }

  return {
    ok: true,
    ctx: { supabase, userId: user.id, restaurantId },
  };
}

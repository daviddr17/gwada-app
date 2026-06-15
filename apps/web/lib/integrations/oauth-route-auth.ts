import {
  assertPlatformFacebookEnabled,
  assertPlatformGoogleBusinessEnabled,
  assertPlatformInstagramEnabled,
  assertPlatformMollieEnabled,
} from "@/lib/integrations/platform-messaging-guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export type OAuthRouteContext = {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  restaurantId: string;
};

async function authorizeRestaurantOAuthRoute(params: {
  restaurantIdRaw: string | null;
  permission: string;
  assertPlatform: (
    sb: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
}): Promise<
  | { ok: true; ctx: OAuthRouteContext }
  | { ok: false; status: number; error: string }
> {
  const restaurantId = params.restaurantIdRaw?.trim() ?? "";
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
      p_permission: params.permission,
    },
  );

  if (rpcError) {
    console.warn("auth_has_restaurant_permission", rpcError.message);
    return { ok: false, status: 403, error: "forbidden" };
  }

  if (!allowed) {
    return { ok: false, status: 403, error: "forbidden" };
  }

  const platform = await params.assertPlatform(supabase);
  if (!platform.ok) {
    return { ok: false, status: 403, error: platform.error };
  }

  return {
    ok: true,
    ctx: { supabase, userId: user.id, restaurantId },
  };
}

export function authorizeFacebookRestaurantRoute(restaurantIdRaw: string | null) {
  return authorizeRestaurantOAuthRoute({
    restaurantIdRaw,
    permission: "integrations.facebook",
    assertPlatform: assertPlatformFacebookEnabled,
  });
}

export function authorizeInstagramRestaurantRoute(
  restaurantIdRaw: string | null,
) {
  return authorizeRestaurantOAuthRoute({
    restaurantIdRaw,
    permission: "integrations.instagram",
    assertPlatform: assertPlatformInstagramEnabled,
  });
}

export function authorizeGoogleBusinessRestaurantRoute(
  restaurantIdRaw: string | null,
) {
  return authorizeRestaurantOAuthRoute({
    restaurantIdRaw,
    permission: "integrations.google_business",
    assertPlatform: assertPlatformGoogleBusinessEnabled,
  });
}

export function authorizeMollieRestaurantRoute(restaurantIdRaw: string | null) {
  return authorizeRestaurantOAuthRoute({
    restaurantIdRaw,
    permission: "integrations.mollie",
    assertPlatform: assertPlatformMollieEnabled,
  });
}

export function authorizeOpeningHoursSettingsRoute(
  restaurantIdRaw: string | null,
) {
  return authorizeRestaurantOAuthRoute({
    restaurantIdRaw,
    permission: "settings.opening_hours",
    assertPlatform: async () => ({ ok: true as const }),
  });
}

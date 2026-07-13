import { upsertRestaurantAppleBusinessConnectIntegration } from "@/lib/supabase/restaurant-apple-business-connect-integration-db";
import { assertPlatformAppleBusinessConnectEnabled } from "@/lib/integrations/platform-messaging-guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
  };
  const restaurantId = body.restaurantId?.trim() ?? "";
  if (!isUuidRestaurantId(restaurantId)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const platform = await assertPlatformAppleBusinessConnectEnabled(sb);
  if (!platform.ok) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: allowed } = await sb.rpc("auth_has_restaurant_permission", {
    p_restaurant_id: restaurantId,
    p_permission: "integrations.apple_business_connect",
  });
  if (!allowed) return Response.json({ error: "forbidden" }, { status: 403 });

  const { error } = await upsertRestaurantAppleBusinessConnectIntegration(
    sb,
    restaurantId,
    {
      status: "disconnected",
      config: {},
      display_name: null,
      connected_at: null,
      last_error: null,
    },
  );

  if (error) {
    return Response.json({ error }, { status: 500 });
  }

  return Response.json({ ok: true });
}

import { assertPlatformMollieEnabled } from "@/lib/integrations/platform-messaging-guard";
import { upsertRestaurantMollieIntegration } from "@/lib/supabase/restaurant-mollie-integration-db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { restaurantId?: string };
  try {
    body = (await req.json()) as { restaurantId?: string };
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const restaurantId = body.restaurantId?.trim() ?? "";
  if (!isUuidRestaurantId(restaurantId)) {
    return Response.json({ error: "invalid_restaurant_id" }, { status: 400 });
  }

  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const platform = await assertPlatformMollieEnabled(sb);
  if (!platform.ok) {
    return Response.json({ error: platform.error }, { status: 403 });
  }

  const { data: allowed } = await sb.rpc("auth_has_restaurant_permission", {
    p_restaurant_id: restaurantId,
    p_permission: "integrations.mollie",
  });
  if (!allowed) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  await upsertRestaurantMollieIntegration({
    restaurantId,
    status: "disconnected",
    config: {},
    displayName: null,
    lastError: null,
  });

  return Response.json({ ok: true });
}

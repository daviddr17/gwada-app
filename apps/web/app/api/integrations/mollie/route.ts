import { assertPlatformMollieEnabled } from "@/lib/integrations/platform-messaging-guard";
import { fetchRestaurantMollieIntegration } from "@/lib/supabase/restaurant-mollie-integration-db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId = new URL(req.url).searchParams.get("restaurantId")?.trim() ?? "";
  if (!isUuidRestaurantId(restaurantId)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
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

  const row = await fetchRestaurantMollieIntegration(sb, restaurantId);
  const status = row?.status ?? "disconnected";

  return Response.json({
    platformEnabled: true,
    configured: status === "working",
    status,
    organizationName:
      row?.config.organization_name ?? row?.display_name ?? null,
    organizationId: row?.config.organization_id ?? null,
    connectedAt: row?.connected_at ?? null,
    lastError: row?.last_error ?? null,
    connectUrl: `/api/integrations/mollie/connect?restaurantId=${restaurantId}`,
  });
}

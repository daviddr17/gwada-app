import { fetchTripadvisorLocationDetails } from "@/lib/integrations/tripadvisor-api-client";
import { assertPlatformTripadvisorEnabled } from "@/lib/integrations/platform-messaging-guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    locationId?: string;
  };

  const restaurantId = body.restaurantId?.trim() ?? "";
  const locationId = body.locationId?.trim() ?? "";
  if (!isUuidRestaurantId(restaurantId) || !locationId) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const platform = await assertPlatformTripadvisorEnabled(sb);
  if (!platform.ok) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: allowed } = await sb.rpc("auth_has_restaurant_permission", {
    p_restaurant_id: restaurantId,
    p_permission: "integrations.tripadvisor",
  });
  if (!allowed) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const details = await fetchTripadvisorLocationDetails(locationId);
  if ("error" in details) {
    return Response.json({ ok: false, error: details.error }, { status: 400 });
  }

  return Response.json({
    ok: true,
    locationName: details.location.name?.trim() || null,
    locationId,
  });
}

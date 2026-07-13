import { fetchPlatformAppleBusinessConnectSecrets } from "@/lib/supabase/platform-apple-business-connect-secrets-db";
import { assertPlatformAppleBusinessConnectEnabled } from "@/lib/integrations/platform-messaging-guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    locationId?: string;
    brandId?: string | null;
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

  const secrets = await fetchPlatformAppleBusinessConnectSecrets();
  if (!secrets?.issuer_id || !secrets?.key_id || !secrets?.private_key) {
    return Response.json(
      { error: "platform_not_configured" },
      { status: 422 },
    );
  }

  // Vorbereitung: echter API-Call folgt, wenn Partner-Zugang aktiv ist.
  return Response.json({
    ok: true,
    locationName: locationId,
    message: "API-Zugang hinterlegt — Location-ID gespeichert.",
  });
}

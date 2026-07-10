import { deleteLexofficeContactsCache } from "@/lib/contacts/lexoffice-contacts-cache-db";
import { teardownLexofficeWebhooks } from "@/lib/integrations/lexoffice-webhook-register-server";
import { assertPlatformLexofficeEnabled } from "@/lib/integrations/platform-messaging-guard";
import {
  fetchRestaurantLexofficeConfig,
  upsertRestaurantLexofficeIntegration,
} from "@/lib/supabase/restaurant-lexoffice-integration-db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
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
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const platform = await assertPlatformLexofficeEnabled(sb);
  if (!platform.ok) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: allowed } = await sb.rpc("auth_has_restaurant_permission", {
    p_restaurant_id: restaurantId,
    p_permission: "integrations.lexoffice",
  });
  if (!allowed) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const existing = await fetchRestaurantLexofficeConfig(sb, restaurantId);
  await teardownLexofficeWebhooks(
    existing?.config.api_key ?? null,
    existing?.config ?? {},
  );

  const { error } = await upsertRestaurantLexofficeIntegration(sb, restaurantId, {
    status: "disconnected",
    display_name: null,
    connected_at: null,
    last_error: null,
    config: {},
  });

  if (error) {
    return Response.json({ error }, { status: 500 });
  }

  const admin = createSupabaseAdminClient();
  if (admin) {
    await deleteLexofficeContactsCache(admin, restaurantId);
  }

  return Response.json({ ok: true });
}

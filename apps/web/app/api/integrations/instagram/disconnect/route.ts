import { authorizeInstagramRestaurantRoute } from "@/lib/integrations/oauth-route-auth";
import { upsertRestaurantOAuthIntegration } from "@/lib/supabase/restaurant-oauth-integration-db";
import {
  oauthConfigFromJson,
  type MetaOAuthIntegrationConfig,
} from "@/lib/integrations/oauth-integration-types";

export const dynamic = "force-dynamic";

function mergeMetaConfig(
  existing: MetaOAuthIntegrationConfig,
  patch: MetaOAuthIntegrationConfig | undefined,
): MetaOAuthIntegrationConfig {
  return { ...existing, ...patch };
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
  };
  const auth = await authorizeInstagramRestaurantRoute(
    body.restaurantId ?? null,
  );
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const { error } = await upsertRestaurantOAuthIntegration(
    auth.ctx.supabase,
    auth.ctx.restaurantId,
    "instagram",
    {
      status: "disconnected",
      display_name: null,
      connected_at: null,
      last_error: null,
      config: { requested_scopes: [], granted_scopes: [] },
    },
    oauthConfigFromJson<MetaOAuthIntegrationConfig>,
    mergeMetaConfig,
  );

  if (error) {
    return Response.json({ error }, { status: 500 });
  }

  return Response.json({ ok: true });
}

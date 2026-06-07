import { authorizeGoogleBusinessRestaurantRoute } from "@/lib/integrations/oauth-route-auth";
import { upsertRestaurantOAuthIntegration } from "@/lib/supabase/restaurant-oauth-integration-db";
import { googleBusinessConfigFromJson } from "@/lib/integrations/google-business-oauth";
import type { GoogleBusinessIntegrationConfig } from "@/lib/integrations/oauth-integration-types";

export const dynamic = "force-dynamic";

function mergeGoogleConfig(
  existing: GoogleBusinessIntegrationConfig,
  patch: GoogleBusinessIntegrationConfig | undefined,
): GoogleBusinessIntegrationConfig {
  return { ...existing, ...patch };
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
  };
  const auth = await authorizeGoogleBusinessRestaurantRoute(
    body.restaurantId ?? null,
  );
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const { error } = await upsertRestaurantOAuthIntegration(
    auth.ctx.supabase,
    auth.ctx.restaurantId,
    "google_business",
    {
      status: "disconnected",
      display_name: null,
      connected_at: null,
      last_error: null,
      config: { requested_scopes: [], granted_scopes: [] },
    },
    googleBusinessConfigFromJson,
    mergeGoogleConfig,
  );

  if (error) {
    return Response.json({ error }, { status: 500 });
  }

  return Response.json({ ok: true });
}

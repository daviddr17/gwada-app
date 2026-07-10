import { syncLexofficeContactsCache } from "@/lib/contacts/lexoffice-contacts-sync-server";
import { fetchLexofficeProfile } from "@/lib/integrations/lexoffice-api";
import { mergeLexofficeApiKey } from "@/lib/integrations/lexoffice-integration-config";
import { ensureLexofficeWebhooksForRestaurant } from "@/lib/integrations/lexoffice-webhook-register-server";
import { assertPlatformLexofficeEnabled } from "@/lib/integrations/platform-messaging-guard";
import {
  fetchRestaurantLexofficeConfig,
  fetchRestaurantLexofficeIntegration,
  upsertRestaurantLexofficeIntegration,
} from "@/lib/supabase/restaurant-lexoffice-integration-db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import type { LexofficeIntegrationResponse } from "@/lib/types/restaurant-integration";

export const dynamic = "force-dynamic";

async function assertCanManageLexoffice(restaurantId: string) {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false as const, status: 401, sb: null };

  const platform = await assertPlatformLexofficeEnabled(sb);
  if (!platform.ok) return { ok: false as const, status: 403, sb: null };

  const { data: allowed } = await sb.rpc("auth_has_restaurant_permission", {
    p_restaurant_id: restaurantId,
    p_permission: "integrations.lexoffice",
  });
  if (!allowed) return { ok: false as const, status: 403, sb: null };
  return { ok: true as const, status: 200, sb };
}

function toResponse(
  row: Awaited<ReturnType<typeof fetchRestaurantLexofficeIntegration>>,
): LexofficeIntegrationResponse {
  const status = row?.status ?? "disconnected";
  const config = row?.config;
  return {
    platformEnabled: true,
    configured: status === "working",
    status,
    companyName: config?.company_name ?? row?.display_name ?? null,
    organizationId: config?.organization_id ?? null,
    taxType: config?.tax_type ?? null,
    businessFeatures: config?.business_features ?? [],
    connectedUserName: config?.connected_user_name ?? null,
    connectedUserEmail: config?.connected_user_email ?? null,
    connectedAt: row?.connected_at ?? null,
    apiKeyConfigured: Boolean(config?.api_key_configured),
    lastError: row?.last_error ?? null,
    webhookWarning: config?.webhook_registration_warning ?? null,
  };
}

export async function GET(req: Request) {
  const restaurantId = new URL(req.url).searchParams.get("restaurantId")?.trim() ?? "";
  if (!isUuidRestaurantId(restaurantId)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await assertCanManageLexoffice(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: "forbidden" }, { status: auth.status });
  }

  const row = await fetchRestaurantLexofficeIntegration(auth.sb, restaurantId);
  return Response.json(toResponse(row));
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    apiKey?: string;
  };

  const restaurantId = body.restaurantId?.trim() ?? "";
  if (!isUuidRestaurantId(restaurantId)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await assertCanManageLexoffice(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: "forbidden" }, { status: auth.status });
  }

  const existing = await fetchRestaurantLexofficeConfig(auth.sb, restaurantId);
  const mergedKey = mergeLexofficeApiKey(
    existing?.config ?? {},
    body.apiKey ?? "",
  );

  if (!mergedKey) {
    return Response.json(
      { error: "API-Key erforderlich." },
      { status: 400 },
    );
  }

  const profileResult = await fetchLexofficeProfile(mergedKey);
  if (!profileResult.ok) {
    const { error } = await upsertRestaurantLexofficeIntegration(
      auth.sb,
      restaurantId,
      {
        status: "disconnected",
        config: {
          ...existing?.config,
          api_key: mergedKey,
        },
        display_name: existing?.display_name ?? null,
        connected_at: existing?.connected_at ?? null,
        last_error: profileResult.error,
      },
    );
    if (error) {
      return Response.json({ error }, { status: 500 });
    }
    return Response.json({ error: profileResult.error }, { status: 400 });
  }

  const { profile } = profileResult;
  const baseConfig = {
    api_key: mergedKey,
    organization_id: profile.organizationId,
    company_name: profile.companyName,
    tax_type: profile.taxType,
    business_features: profile.businessFeatures ?? [],
    connected_user_name: profile.created?.userName,
    connected_user_email: profile.created?.userEmail,
  };

  const { config: configWithWebhooks, webhookWarning } =
    await ensureLexofficeWebhooksForRestaurant(
    auth.sb,
    restaurantId,
    mergedKey,
    {
      ...existing?.config,
      ...baseConfig,
    },
  );

  const { error } = await upsertRestaurantLexofficeIntegration(auth.sb, restaurantId, {
    status: "working",
    display_name: profile.companyName,
    connected_at: existing?.connected_at ?? new Date().toISOString(),
    last_error: null,
    config: configWithWebhooks,
  });

  if (error) {
    return Response.json({ error }, { status: 500 });
  }

  void syncLexofficeContactsCache(restaurantId, mergedKey);

  const row = await fetchRestaurantLexofficeIntegration(auth.sb, restaurantId);
  const response = toResponse(row);
  if (webhookWarning) {
    response.webhookWarning = webhookWarning;
  }
  return Response.json(response);
}

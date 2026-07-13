import { assertPlatformAppleBusinessConnectEnabled } from "@/lib/integrations/platform-messaging-guard";
import {
  fetchRestaurantAppleBusinessConnectIntegration,
  upsertRestaurantAppleBusinessConnectIntegration,
} from "@/lib/supabase/restaurant-apple-business-connect-integration-db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import type { AppleBusinessConnectIntegrationResponse } from "@/lib/types/restaurant-integration";

export const dynamic = "force-dynamic";

async function assertCanManage(restaurantId: string) {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false as const, status: 401, sb: null };

  const platform = await assertPlatformAppleBusinessConnectEnabled(sb);
  if (!platform.ok) return { ok: false as const, status: 403, sb: null };

  const { data: allowed } = await sb.rpc("auth_has_restaurant_permission", {
    p_restaurant_id: restaurantId,
    p_permission: "integrations.apple_business_connect",
  });
  if (!allowed) return { ok: false as const, status: 403, sb: null };
  return { ok: true as const, status: 200, sb };
}

function toResponse(
  row: Awaited<ReturnType<typeof fetchRestaurantAppleBusinessConnectIntegration>>,
  platformEnabled = true,
): AppleBusinessConnectIntegrationResponse {
  const status = row?.status ?? "disconnected";
  const config = row?.config;
  return {
    platformEnabled,
    configured: status === "working",
    status,
    locationId: config?.location_id ?? null,
    locationName: config?.location_name ?? row?.display_name ?? null,
    brandId: config?.brand_id ?? null,
    connectedAt: row?.connected_at ?? null,
    lastError: row?.last_error ?? null,
  };
}

export async function GET(req: Request) {
  const restaurantId = new URL(req.url).searchParams.get("restaurantId")?.trim() ?? "";
  if (!isUuidRestaurantId(restaurantId)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await assertCanManage(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: "forbidden" }, { status: auth.status });
  }

  const row = await fetchRestaurantAppleBusinessConnectIntegration(
    auth.sb,
    restaurantId,
  );
  return Response.json(toResponse(row));
}

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

  const auth = await assertCanManage(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: "forbidden" }, { status: auth.status });
  }

  const { error } = await upsertRestaurantAppleBusinessConnectIntegration(
    auth.sb,
    restaurantId,
    {
      status: "working",
      config: {
        location_id: locationId,
        brand_id: body.brandId?.trim() || undefined,
        location_name: locationId,
      },
      display_name: locationId,
      connected_at: new Date().toISOString(),
      last_error: null,
    },
  );

  if (error) {
    return Response.json({ error }, { status: 500 });
  }

  const row = await fetchRestaurantAppleBusinessConnectIntegration(
    auth.sb,
    restaurantId,
  );
  return Response.json(toResponse(row));
}

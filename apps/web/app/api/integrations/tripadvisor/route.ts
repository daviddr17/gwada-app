import { fetchTripadvisorLocationDetails } from "@/lib/integrations/tripadvisor-api-client";
import { assertPlatformTripadvisorEnabled } from "@/lib/integrations/platform-messaging-guard";
import {
  fetchRestaurantTripadvisorConfigAdmin,
  fetchRestaurantTripadvisorIntegration,
  upsertRestaurantTripadvisorIntegration,
} from "@/lib/supabase/restaurant-tripadvisor-integration-db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import type { TripadvisorIntegrationResponse } from "@/lib/types/restaurant-integration";

export const dynamic = "force-dynamic";

async function assertCanManageTripadvisor(restaurantId: string) {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false as const, status: 401, sb: null };

  const platform = await assertPlatformTripadvisorEnabled(sb);
  if (!platform.ok) return { ok: false as const, status: 403, sb: null };

  const { data: allowed } = await sb.rpc("auth_has_restaurant_permission", {
    p_restaurant_id: restaurantId,
    p_permission: "integrations.tripadvisor",
  });
  if (!allowed) return { ok: false as const, status: 403, sb: null };
  return { ok: true as const, status: 200, sb };
}

function toResponse(
  row: Awaited<ReturnType<typeof fetchRestaurantTripadvisorIntegration>>,
  platformEnabled = true,
): TripadvisorIntegrationResponse {
  const status = row?.status ?? "disconnected";
  const config = row?.config;
  return {
    platformEnabled,
    configured: status === "working",
    status,
    locationId: config?.location_id ?? null,
    locationName: config?.location_name ?? row?.display_name ?? null,
    connectedAt: row?.connected_at ?? null,
    lastError: row?.last_error ?? null,
  };
}

export async function GET(req: Request) {
  const restaurantId = new URL(req.url).searchParams.get("restaurantId")?.trim() ?? "";
  if (!isUuidRestaurantId(restaurantId)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await assertCanManageTripadvisor(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: "forbidden" }, { status: auth.status });
  }

  const row = await fetchRestaurantTripadvisorIntegration(auth.sb, restaurantId);
  return Response.json(toResponse(row));
}

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

  const auth = await assertCanManageTripadvisor(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: "forbidden" }, { status: auth.status });
  }

  const existing = await fetchRestaurantTripadvisorConfigAdmin(restaurantId);
  const details = await fetchTripadvisorLocationDetails(locationId);
  if ("error" in details) {
    const { error } = await upsertRestaurantTripadvisorIntegration(
      auth.sb,
      restaurantId,
      {
        status: "disconnected",
        config: {
          ...existing?.config,
          location_id: locationId,
        },
        display_name: existing?.display_name ?? null,
        connected_at: existing?.connected_at ?? null,
        last_error: details.error,
      },
    );
    if (error) {
      return Response.json({ error }, { status: 500 });
    }
    return Response.json({ error: details.error }, { status: 400 });
  }

  const locationName = details.location.name?.trim() || null;
  const { error } = await upsertRestaurantTripadvisorIntegration(auth.sb, restaurantId, {
    status: "working",
    display_name: locationName,
    connected_at: existing?.connected_at ?? new Date().toISOString(),
    last_error: null,
    config: {
      location_id: locationId,
      location_name: locationName ?? undefined,
    },
  });

  if (error) {
    return Response.json({ error }, { status: 500 });
  }

  const row = await fetchRestaurantTripadvisorIntegration(auth.sb, restaurantId);
  return Response.json(toResponse(row));
}

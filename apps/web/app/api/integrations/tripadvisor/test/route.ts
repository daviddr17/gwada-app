import {
  ensureTripadvisorAllowlistLocation,
  verifyTripadvisorLocationConnection,
} from "@/lib/integrations/tripadvisor-api-client";
import { tripadvisorErrorMessageForUser } from "@/lib/integrations/tripadvisor-user-error-messages";
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

  const details = await verifyTripadvisorLocationConnection(locationId);
  if ("error" in details) {
    return Response.json(
      {
        ok: false,
        error: tripadvisorErrorMessageForUser(details.error, details.status),
        code: details.error,
      },
      { status: details.status === 429 ? 429 : 400 },
    );
  }

  const locationName = details.location.name?.trim() || null;
  const existing = await fetchRestaurantTripadvisorConfigAdmin(restaurantId);
  const allowlist = await ensureTripadvisorAllowlistLocation(locationId);
  const allowlistHint =
    "error" in allowlist
      ? tripadvisorErrorMessageForUser(
          allowlist.status === 403
            ? "tripadvisor_allowlist_denied"
            : allowlist.error,
          allowlist.status,
        )
      : null;

  // Erfolgreicher Test heilt hängende „Verbindung fehlgeschlagen“-Zustände.
  const { error } = await upsertRestaurantTripadvisorIntegration(sb, restaurantId, {
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

  const row = await fetchRestaurantTripadvisorIntegration(sb, restaurantId);

  return Response.json({
    ok: true,
    allowlistHint,
    ...toResponse(row),
  });
}

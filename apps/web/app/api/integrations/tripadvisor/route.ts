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

/**
 * Catalog-Verifikation ok → Integration auf working setzen.
 * Allowlist wird best effort versucht (Content-APIs); Fehler nur als Hinweis.
 */
async function connectTripadvisorLocation(params: {
  sb: NonNullable<Awaited<ReturnType<typeof assertCanManageTripadvisor>>["sb"]>;
  restaurantId: string;
  locationId: string;
}): Promise<
  | { ok: true; response: TripadvisorIntegrationResponse; allowlistHint: string | null }
  | { ok: false; status: number; error: string; code: string }
> {
  const existing = await fetchRestaurantTripadvisorConfigAdmin(params.restaurantId);
  const details = await verifyTripadvisorLocationConnection(params.locationId);
  if ("error" in details) {
    const { error } = await upsertRestaurantTripadvisorIntegration(
      params.sb,
      params.restaurantId,
      {
        status: "disconnected",
        config: {
          ...existing?.config,
          location_id: params.locationId,
        },
        display_name: existing?.display_name ?? null,
        connected_at: existing?.connected_at ?? null,
        last_error: details.error,
      },
    );
    if (error) {
      return { ok: false, status: 500, error, code: "persist_failed" };
    }
    return {
      ok: false,
      status: details.status === 429 ? 429 : 400,
      error: tripadvisorErrorMessageForUser(details.error, details.status),
      code: details.error,
    };
  }

  const locationName = details.location.name?.trim() || null;
  const allowlist = await ensureTripadvisorAllowlistLocation(params.locationId);
  const allowlistHint =
    "error" in allowlist
      ? tripadvisorErrorMessageForUser(
          allowlist.status === 403
            ? "tripadvisor_allowlist_denied"
            : allowlist.error,
          allowlist.status,
        )
      : null;

  const { error } = await upsertRestaurantTripadvisorIntegration(
    params.sb,
    params.restaurantId,
    {
      status: "working",
      display_name: locationName,
      connected_at: existing?.connected_at ?? new Date().toISOString(),
      // Catalog ok = verbunden. Allowlist-Probleme sind Content-Hinweise, kein Hard-Fail.
      last_error: null,
      config: {
        location_id: params.locationId,
        location_name: locationName ?? undefined,
      },
    },
  );

  if (error) {
    return { ok: false, status: 500, error, code: "persist_failed" };
  }

  const row = await fetchRestaurantTripadvisorIntegration(
    params.sb,
    params.restaurantId,
  );
  return { ok: true, response: toResponse(row), allowlistHint };
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

  const result = await connectTripadvisorLocation({
    sb: auth.sb,
    restaurantId,
    locationId,
  });
  if (!result.ok) {
    return Response.json(
      { error: result.error, code: result.code },
      { status: result.status },
    );
  }

  return Response.json({
    ...result.response,
    allowlistHint: result.allowlistHint,
  });
}

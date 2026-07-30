import "server-only";

import { syncWhatsappFromWaha } from "@/lib/integrations/waha-connect-service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  fetchRestaurantWhatsappIntegration,
  upsertRestaurantWhatsappIntegration,
} from "@/lib/supabase/restaurant-integrations-db";
import {
  getRestaurantWahaServerIdAdmin,
  getWahaServerByIdAdmin,
  wahaServerRowToConfig,
} from "@/lib/supabase/waha-servers-db";
import {
  mapWahaStatusToIntegration,
  wahaGetSession,
  wahaLogoutSession,
  wahaRestartSession,
  wahaStartSession,
  wahaStopSession,
  wahaUpdateSessionWebhooks,
  type WahaSessionPayload,
} from "@/lib/waha/waha-client";
import {
  getWahaServerConfigForRestaurantAdmin,
  type WahaServerConfig,
} from "@/lib/waha/waha-config";
import { wahaSessionNameForRestaurant } from "@/lib/waha/waha-session-name";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import {
  WAHA_SESSION_ADMIN_ACTIONS,
  type WahaSessionAdminAction,
  type WahaSessionAdminDetail,
} from "@/lib/waha/waha-server-types";

export { WAHA_SESSION_ADMIN_ACTIONS };
export type { WahaSessionAdminAction, WahaSessionAdminDetail };

export function isWahaSessionAdminAction(
  value: string,
): value is WahaSessionAdminAction {
  return (WAHA_SESSION_ADMIN_ACTIONS as readonly string[]).includes(value);
}

async function resolveExistingSessionConfig(
  restaurantId: string,
): Promise<WahaServerConfig | null> {
  const serverId = await getRestaurantWahaServerIdAdmin(restaurantId);
  if (serverId) {
    const row = await getWahaServerByIdAdmin(serverId);
    if (row) {
      const config = wahaServerRowToConfig(row);
      if (config) return config;
    }
  }
  return getWahaServerConfigForRestaurantAdmin(restaurantId);
}

function liveFromPayload(session: WahaSessionPayload | null): {
  status: string | null;
  phoneNumber: string | null;
  displayName: string | null;
} {
  if (!session) {
    return { status: null, phoneNumber: null, displayName: null };
  }
  const meId = session.me?.id ?? null;
  const phone =
    typeof meId === "string" ? meId.replace(/@.*$/, "").replace(/\D/g, "") : null;
  return {
    status: session.status ?? null,
    phoneNumber: phone || null,
    displayName: session.me?.pushName ?? session.me?.name ?? null,
  };
}

export async function loadWahaSessionAdminDetail(
  restaurantId: string,
): Promise<
  | { ok: true; detail: WahaSessionAdminDetail }
  | { ok: false; error: string; status: number }
> {
  if (!isUuidRestaurantId(restaurantId)) {
    return { ok: false, error: "invalid_restaurant", status: 400 };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "admin_unavailable", status: 503 };
  }

  const existing = await fetchRestaurantWhatsappIntegration(admin, restaurantId);
  if (!existing) {
    return { ok: false, error: "not_found", status: 404 };
  }

  const sessionName =
    existing.waha_session_name || wahaSessionNameForRestaurant(restaurantId);
  const config = await resolveExistingSessionConfig(restaurantId);

  let live: WahaSessionAdminDetail["live"] = {
    ok: false,
    status: null,
    phoneNumber: null,
    displayName: null,
    error: config ? null : "waha_not_configured",
  };

  if (config) {
    const liveRes = await wahaGetSession(config, sessionName);
    if (liveRes.ok) {
      const parsed = liveFromPayload(liveRes.data);
      live = {
        ok: true,
        status: parsed.status,
        phoneNumber: parsed.phoneNumber,
        displayName: parsed.displayName,
        error: null,
      };
    } else {
      live = {
        ok: false,
        status: null,
        phoneNumber: null,
        displayName: null,
        error: liveRes.error,
      };
    }
  }

  const wahaServerId = await getRestaurantWahaServerIdAdmin(restaurantId);

  return {
    ok: true,
    detail: {
      restaurantId,
      sessionName,
      dbStatus: existing.status,
      phoneNumber: existing.phone_number,
      displayName: existing.display_name,
      lastError: existing.last_error,
      connectedAt: existing.connected_at,
      updatedAt: existing.updated_at,
      wahaServerId,
      live,
    },
  };
}

export async function runWahaSessionAdminAction(
  restaurantId: string,
  action: WahaSessionAdminAction,
): Promise<
  | { ok: true; detail: WahaSessionAdminDetail; message: string }
  | { ok: false; error: string; status: number }
> {
  if (!isUuidRestaurantId(restaurantId)) {
    return { ok: false, error: "invalid_restaurant", status: 400 };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "admin_unavailable", status: 503 };
  }

  const existing = await fetchRestaurantWhatsappIntegration(admin, restaurantId);
  if (!existing) {
    return { ok: false, error: "not_found", status: 404 };
  }

  const sessionName =
    existing.waha_session_name || wahaSessionNameForRestaurant(restaurantId);
  const config = await resolveExistingSessionConfig(restaurantId);
  if (!config) {
    return { ok: false, error: "waha_not_configured", status: 503 };
  }

  let message = "OK";

  switch (action) {
    case "refresh": {
      const liveRes = await wahaGetSession(config, sessionName);
      if (!liveRes.ok) {
        if (liveRes.status === 404) {
          await upsertRestaurantWhatsappIntegration(admin, restaurantId, {
            status: "disconnected",
            last_error: "Session nicht auf WAHA gefunden",
          });
          message = "Session fehlt auf WAHA — DB auf getrennt gesetzt.";
          break;
        }
        return { ok: false, error: liveRes.error, status: 502 };
      }
      const mapped = mapWahaStatusToIntegration(liveRes.data.status);
      const parsed = liveFromPayload(liveRes.data);
      await upsertRestaurantWhatsappIntegration(admin, restaurantId, {
        status: mapped,
        phone_number: parsed.phoneNumber ?? existing.phone_number,
        display_name: parsed.displayName ?? existing.display_name,
        last_error: null,
        connected_at:
          mapped === "working"
            ? existing.connected_at ?? new Date().toISOString()
            : existing.connected_at,
      });
      message = "Status von WAHA synchronisiert.";
      break;
    }
    case "restart": {
      const res = await wahaRestartSession(config, sessionName);
      if (!res.ok) {
        const start = await wahaStartSession(config, sessionName);
        if (!start.ok) {
          return { ok: false, error: res.error, status: 502 };
        }
        await upsertRestaurantWhatsappIntegration(admin, restaurantId, {
          status: mapWahaStatusToIntegration(start.data.status),
          last_error: null,
        });
        message = "Neustart fehlgeschlagen — Start ausgelöst.";
        break;
      }
      await upsertRestaurantWhatsappIntegration(admin, restaurantId, {
        status: mapWahaStatusToIntegration(res.data.status),
        last_error: null,
      });
      message = "Session neu gestartet.";
      break;
    }
    case "start": {
      const res = await wahaStartSession(config, sessionName);
      if (!res.ok) {
        return { ok: false, error: res.error, status: 502 };
      }
      await upsertRestaurantWhatsappIntegration(admin, restaurantId, {
        status: mapWahaStatusToIntegration(res.data.status),
        last_error: null,
      });
      message = "Session gestartet.";
      break;
    }
    case "stop": {
      const res = await wahaStopSession(config, sessionName);
      if (!res.ok) {
        return { ok: false, error: res.error, status: 502 };
      }
      await upsertRestaurantWhatsappIntegration(admin, restaurantId, {
        status: "stopped",
        last_error: null,
      });
      message = "Session gestoppt.";
      break;
    }
    case "logout": {
      const res = await wahaLogoutSession(config, sessionName);
      if (!res.ok) {
        return { ok: false, error: res.error, status: 502 };
      }
      await upsertRestaurantWhatsappIntegration(admin, restaurantId, {
        status: "disconnected",
        phone_number: null,
        display_name: null,
        connected_at: null,
        last_error: null,
      });
      message = "Session ausgeloggt (WhatsApp-Gerät getrennt).";
      break;
    }
    case "sync_webhooks": {
      const res = await wahaUpdateSessionWebhooks(
        config,
        sessionName,
        restaurantId,
      );
      if (!res.ok) {
        return { ok: false, error: res.error, status: 502 };
      }
      message = "Webhooks / Session-Config aktualisiert.";
      break;
    }
    case "heal": {
      const result = await syncWhatsappFromWaha(admin, config, restaurantId, {
        forceRestart: true,
      });
      if (result.status === "failed") {
        return {
          ok: false,
          error: result.message ?? "heal_failed",
          status: 502,
        };
      }
      message = "Session geheilt (Restart + Sync).";
      break;
    }
    default:
      return { ok: false, error: "invalid_action", status: 400 };
  }

  const detail = await loadWahaSessionAdminDetail(restaurantId);
  if (!detail.ok) {
    return { ok: false, error: detail.error, status: detail.status };
  }
  return { ok: true, detail: detail.detail, message };
}

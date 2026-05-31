import {
  fetchRestaurantWhatsappIntegration,
  integrationStateFromWahaSession,
  upsertRestaurantWhatsappIntegration,
} from "@/lib/supabase/restaurant-integrations-db";
import type { WahaConnectResponse } from "@/lib/types/restaurant-integration";
import {
  wahaCreateSession,
  wahaGetSession,
  wahaRestartSession,
  wahaStartSession,
} from "@/lib/waha/waha-client";
import type { WahaServerConfig } from "@/lib/waha/waha-config";
import { wahaSessionNameForRestaurant } from "@/lib/waha/waha-session-name";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function syncWhatsappFromWaha(
  sb: SupabaseClient,
  config: WahaServerConfig,
  restaurantId: string,
  options?: { forceRestart?: boolean },
): Promise<WahaConnectResponse> {
  const sessionName = wahaSessionNameForRestaurant(restaurantId);
  const existing = await fetchRestaurantWhatsappIntegration(sb, restaurantId);

  const sessionRes = await wahaGetSession(config, sessionName);
  let session = sessionRes.ok ? sessionRes.data : null;

  if (!sessionRes.ok && sessionRes.status === 404) {
    const createRes = await wahaCreateSession(config, sessionName, restaurantId);
    if (!createRes.ok) {
      await upsertRestaurantWhatsappIntegration(sb, restaurantId, {
        status: "failed",
        last_error: createRes.error,
      });
      return {
        configured: true,
        status: "failed",
        wahaStatus: null,
        phoneNumber: null,
        displayName: null,
        needsQr: false,
        needsReconnect: true,
        message: createRes.error,
      };
    }
    session = createRes.data;
  } else if (options?.forceRestart && session) {
    const restartRes = await wahaRestartSession(config, sessionName);
    if (restartRes.ok) session = restartRes.data;
    else {
      const startRes = await wahaStartSession(config, sessionName);
      if (startRes.ok) session = startRes.data;
    }
  } else if (session?.status === "FAILED" || session?.status === "STOPPED") {
    const restartRes = await wahaRestartSession(config, sessionName);
    if (restartRes.ok) session = restartRes.data;
    else {
      const startRes = await wahaStartSession(config, sessionName);
      if (startRes.ok) session = startRes.data;
    }
  } else if (
    session &&
    session.status !== "WORKING" &&
    session.status !== "SCAN_QR_CODE"
  ) {
    const startRes = await wahaStartSession(config, sessionName);
    if (startRes.ok) session = startRes.data;
  }

  const mapped = integrationStateFromWahaSession(
    session,
    existing?.status ?? "starting",
  );

  await upsertRestaurantWhatsappIntegration(sb, restaurantId, {
    status: mapped.status,
    phone_number: mapped.phone_number,
    display_name: mapped.display_name,
    connected_at: mapped.connected_at,
    last_error: null,
  });

  const needsReconnect =
    mapped.status === "failed" ||
    mapped.status === "stopped" ||
    mapped.status === "disconnected";

  return {
    configured: true,
    status: mapped.status,
    wahaStatus: mapped.wahaStatus,
    phoneNumber: mapped.phone_number,
    displayName: mapped.display_name,
    needsQr: mapped.status === "scan_qr",
    needsReconnect,
    message:
      mapped.status === "failed"
        ? "Session fehlgeschlagen — bitte erneut verbinden (QR oder Pairing-Code)."
        : undefined,
  };
}

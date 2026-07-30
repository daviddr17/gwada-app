import {
  fetchRestaurantWhatsappIntegration,
  integrationStateFromWahaSession,
  upsertRestaurantWhatsappIntegration,
} from "@/lib/supabase/restaurant-integrations-db";
import { syncInboxHistoryOnConnect } from "@/lib/contacts/sync-inbox-history-on-connect-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { WahaConnectResponse } from "@/lib/types/restaurant-integration";
import {
  wahaCreateSession,
  wahaGetSession,
  wahaRestartSession,
  wahaStartSession,
  wahaUpdateSessionWebhooks,
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
  const wasWorking = existing?.status === "working";

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
  } else if (
    session?.status === "FAILED" ||
    session?.status === "STOPPED" ||
    session?.status === "STARTING"
  ) {
    // STARTING oft hängend (Chrome/Engine) — Restart statt erneut start.
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

  // Persistenz immer mit Service-Role — User-Client kann trotz Live-WORKING
  // am Upsert scheitern (fehlende integrations.whatsapp-Permission) → UI zeigt
  // „verbunden“, Dispatch liest dann noch alten DB-Status.
  const admin = createSupabaseAdminClient();
  const writeSb = admin ?? sb;
  const { error: upsertError } = await upsertRestaurantWhatsappIntegration(
    writeSb,
    restaurantId,
    {
      status: mapped.status,
      phone_number: mapped.phone_number,
      display_name: mapped.display_name,
      connected_at: mapped.connected_at,
      last_error: null,
    },
  );
  if (upsertError) {
    console.warn("[waha] sync upsert restaurant_integrations", upsertError);
  }

  if (mapped.status === "working" && !wasWorking && admin) {
    void syncInboxHistoryOnConnect(admin, {
      restaurantId,
      whatsapp: true,
    }).catch((e) => {
      console.warn("[contact-inbox] history-on-connect whatsapp", e);
    });
  }

  if (session) {
    void wahaUpdateSessionWebhooks(config, sessionName, restaurantId).catch(
      (e) => {
        console.warn("[waha] update webhooks", e);
      },
    );
  }

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

import "server-only";

import { buildCashPointClosingPayload } from "@/lib/pos/fiskaly-cash-point-closing";
import {
  insertDsfinvkCashPointClosing,
  waitForDsfinvkCashPointClosing,
} from "@/lib/pos/fiskaly-dsfinvk";
import { ensureRestaurantDsfinvkCashRegister } from "@/lib/pos/fiskaly-provision";
import { fetchPlatformFiskalySecretsAdmin } from "@/lib/supabase/platform-fiskaly-secrets-db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type RegisterSessionResult =
  | { ok: true; openedAt: string; alreadyOpen?: boolean }
  | { ok: false; error: string; status?: number };

export type RegisterCloseResult =
  | {
      ok: true;
      closingId: string;
      zNr: number;
      state: string;
      closedAt: string;
    }
  | { ok: false; error: string; status?: number };

export async function ensureRegisterSessionOpen(
  restaurantId: string,
): Promise<RegisterSessionResult> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "admin_unavailable", status: 500 };

  const dsfinvk = await ensureRestaurantDsfinvkCashRegister(restaurantId);
  if (!dsfinvk.ok) {
    return { ok: false, error: dsfinvk.error, status: 502 };
  }

  const { data: config } = await admin
    .from("pos_restaurant_fiscal_config")
    .select("register_opened_at, dsfinvk_cash_register_ready")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (!config?.dsfinvk_cash_register_ready) {
    return { ok: false, error: "dsfinvk_cash_register_not_ready", status: 502 };
  }

  if (config.register_opened_at) {
    return {
      ok: true,
      openedAt: config.register_opened_at,
      alreadyOpen: true,
    };
  }

  const openedAt = new Date().toISOString();
  const { error } = await admin
    .from("pos_restaurant_fiscal_config")
    .update({ register_opened_at: openedAt })
    .eq("restaurant_id", restaurantId);

  if (error) {
    return { ok: false, error: error.message, status: 500 };
  }

  return { ok: true, openedAt };
}

export async function openRegisterSession(
  restaurantId: string,
): Promise<RegisterSessionResult> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "admin_unavailable", status: 500 };

  const dsfinvk = await ensureRestaurantDsfinvkCashRegister(restaurantId);
  if (!dsfinvk.ok) {
    return { ok: false, error: dsfinvk.error, status: 502 };
  }

  const { data: config } = await admin
    .from("pos_restaurant_fiscal_config")
    .select("register_opened_at")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (config?.register_opened_at) {
    return {
      ok: false,
      error: "register_already_open",
      status: 409,
    };
  }

  return ensureRegisterSessionOpen(restaurantId);
}

export async function closeRegisterSession(
  restaurantId: string,
): Promise<RegisterCloseResult> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "admin_unavailable", status: 500 };

  const platform = await fetchPlatformFiskalySecretsAdmin();
  if (!platform?.enabled || !platform.apiKey || !platform.apiSecret) {
    return { ok: false, error: "fiskaly_not_configured", status: 502 };
  }

  const dsfinvk = await ensureRestaurantDsfinvkCashRegister(restaurantId);
  if (!dsfinvk.ok) {
    return { ok: false, error: dsfinvk.error, status: 502 };
  }

  const { data: config, error: configError } = await admin
    .from("pos_restaurant_fiscal_config")
    .select(
      "fiskaly_client_id, register_opened_at, cash_point_closing_counter, dsfinvk_cash_register_ready",
    )
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (configError || !config) {
    return { ok: false, error: "fiscal_config_not_found", status: 404 };
  }

  if (!config.register_opened_at) {
    return { ok: false, error: "register_not_open", status: 400 };
  }

  const clientId = config.fiskaly_client_id?.trim();
  if (!clientId || !config.dsfinvk_cash_register_ready) {
    return { ok: false, error: "dsfinvk_cash_register_not_ready", status: 502 };
  }

  const zNr = Number(config.cash_point_closing_counter ?? 0) + 1;
  const closedAt = new Date().toISOString();

  const built = await buildCashPointClosingPayload({
    restaurantId,
    clientId,
    zNr,
    sessionOpenedAt: config.register_opened_at,
    sessionClosedAt: closedAt,
  });

  if (!built.ok) {
    return { ok: false, error: built.error, status: 400 };
  }

  const closingId = crypto.randomUUID();
  const inserted = await insertDsfinvkCashPointClosing({
    dsfinvkBaseUrl: platform.dsfinvkBaseUrl,
    apiKey: platform.apiKey,
    apiSecret: platform.apiSecret,
    closingId,
    payload: built.payload,
  });

  if (!inserted.ok) {
    console.error("[pos] DSFinV-K insert cash_point_closing failed", inserted.error);
    return {
      ok: false,
      error: `Kassenabschluss anlegen: ${inserted.error}`,
      status: 502,
    };
  }

  const waited = await waitForDsfinvkCashPointClosing({
    dsfinvkBaseUrl: platform.dsfinvkBaseUrl,
    apiKey: platform.apiKey,
    apiSecret: platform.apiSecret,
    closingId,
    clientId,
    initialResponse: inserted.response,
  });

  if (!waited.ok) {
    console.error("[pos] DSFinV-K cash_point_closing poll failed", waited.error);
    return {
      ok: false,
      error: `Kassenabschluss-Status: ${waited.error}`,
      status: 502,
    };
  }

  const { error: saveError } = await admin
    .from("pos_restaurant_fiscal_config")
    .update({
      register_opened_at: null,
      cash_point_closing_counter: zNr,
      last_cash_point_closing_id: closingId,
      last_closing_at: closedAt,
      last_closing_z_nr: zNr,
    })
    .eq("restaurant_id", restaurantId);

  if (saveError) {
    return { ok: false, error: saveError.message, status: 500 };
  }

  return {
    ok: true,
    closingId,
    zNr,
    state: waited.state,
    closedAt,
  };
}

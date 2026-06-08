import "server-only";

import { buildCashPointClosingPayload } from "@/lib/pos/fiskaly-cash-point-closing";
import { dsfinvkBusinessDateFromClose } from "@/lib/pos/fiskaly-dsfinvk-export";
import {
  insertDsfinvkCashPointClosing,
  waitForDsfinvkCashPointClosing,
} from "@/lib/pos/fiskaly-dsfinvk";
import { ensureRestaurantDsfinvkCashRegister } from "@/lib/pos/fiskaly-provision";
import {
  computeExpectedCashCents,
  getOpenRegisterSession,
} from "@/lib/pos/register-report-aggregate";
import { fetchPlatformFiskalySecretsAdmin } from "@/lib/supabase/platform-fiskaly-secrets-db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type RegisterSessionResult =
  | {
      ok: true;
      sessionId: string;
      openedAt: string;
      openingCashCents: number;
      alreadyOpen?: boolean;
    }
  | { ok: false; error: string; status?: number };

export type RegisterCloseResult =
  | {
      ok: true;
      sessionId: string;
      closingId: string;
      zNr: number;
      state: string;
      closedAt: string;
      expectedCashCents: number;
      closingCashCents: number;
      cashDifferenceCents: number;
    }
  | { ok: false; error: string; status?: number };

export type RegisterOpenParams = {
  openingCashCents: number;
  openedByProfileId?: string | null;
};

export type RegisterCloseParams = {
  closingCashCents: number;
  closedByProfileId?: string | null;
};

async function linkSessionToFiscalConfig(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  restaurantId: string,
  sessionId: string,
  openedAt: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await admin
    .from("pos_restaurant_fiscal_config")
    .update({
      register_opened_at: openedAt,
      current_register_session_id: sessionId,
    })
    .eq("restaurant_id", restaurantId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function ensureRegisterSessionOpen(
  restaurantId: string,
  openedByProfileId?: string | null,
): Promise<RegisterSessionResult> {
  const existing = await getOpenRegisterSession(restaurantId);
  if (existing) {
    return {
      ok: true,
      sessionId: existing.id,
      openedAt: existing.opened_at,
      openingCashCents: Number(existing.opening_cash_cents),
      alreadyOpen: true,
    };
  }

  return openRegisterSession(restaurantId, {
    openingCashCents: 0,
    openedByProfileId,
  });
}

export async function openRegisterSession(
  restaurantId: string,
  params: RegisterOpenParams,
): Promise<RegisterSessionResult> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "admin_unavailable", status: 500 };

  const openingCashCents = Math.max(0, Math.round(params.openingCashCents));

  const dsfinvk = await ensureRestaurantDsfinvkCashRegister(restaurantId);
  if (!dsfinvk.ok) {
    return { ok: false, error: dsfinvk.error, status: 502 };
  }

  const { data: config } = await admin
    .from("pos_restaurant_fiscal_config")
    .select("register_opened_at, dsfinvk_cash_register_ready, current_register_session_id")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (!config?.dsfinvk_cash_register_ready) {
    return { ok: false, error: "dsfinvk_cash_register_not_ready", status: 502 };
  }

  const existing = await getOpenRegisterSession(restaurantId);
  if (existing || config.register_opened_at) {
    return {
      ok: false,
      error: "register_already_open",
      status: 409,
    };
  }

  const openedAt = new Date().toISOString();
  const { data: session, error: sessionError } = await admin
    .from("pos_register_sessions")
    .insert({
      restaurant_id: restaurantId,
      opened_at: openedAt,
      opening_cash_cents: openingCashCents,
      opened_by_profile_id: params.openedByProfileId ?? null,
    })
    .select("id")
    .single();

  if (sessionError || !session) {
    return { ok: false, error: sessionError?.message ?? "session_create_failed", status: 500 };
  }

  const linked = await linkSessionToFiscalConfig(
    admin,
    restaurantId,
    session.id as string,
    openedAt,
  );
  if (!linked.ok) {
    return { ok: false, error: linked.error, status: 500 };
  }

  return {
    ok: true,
    sessionId: session.id as string,
    openedAt,
    openingCashCents,
  };
}

export async function closeRegisterSession(
  restaurantId: string,
  params: RegisterCloseParams,
): Promise<RegisterCloseResult> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "admin_unavailable", status: 500 };

  const closingCashCents = Math.max(0, Math.round(params.closingCashCents));

  const platform = await fetchPlatformFiskalySecretsAdmin();
  if (!platform?.enabled || !platform.apiKey || !platform.apiSecret) {
    return { ok: false, error: "fiskaly_not_configured", status: 502 };
  }

  const dsfinvk = await ensureRestaurantDsfinvkCashRegister(restaurantId);
  if (!dsfinvk.ok) {
    return { ok: false, error: dsfinvk.error, status: 502 };
  }

  const session = await getOpenRegisterSession(restaurantId);
  if (!session) {
    return { ok: false, error: "register_not_open", status: 400 };
  }

  const { data: config, error: configError } = await admin
    .from("pos_restaurant_fiscal_config")
    .select(
      "fiskaly_client_id, cash_point_closing_counter, dsfinvk_cash_register_ready",
    )
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (configError || !config) {
    return { ok: false, error: "fiscal_config_not_found", status: 404 };
  }

  const clientId = config.fiskaly_client_id?.trim();
  if (!clientId || !config.dsfinvk_cash_register_ready) {
    return { ok: false, error: "dsfinvk_cash_register_not_ready", status: 502 };
  }

  const closedAt = new Date().toISOString();
  const expectedCashCents = await computeExpectedCashCents({
    restaurantId,
    sessionOpenedAt: session.opened_at,
    sessionClosedAt: closedAt,
    openingCashCents: Number(session.opening_cash_cents),
  });
  const cashDifferenceCents = closingCashCents - expectedCashCents;

  const zNr = Number(config.cash_point_closing_counter ?? 0) + 1;
  const businessDate = dsfinvkBusinessDateFromClose(closedAt);

  const built = await buildCashPointClosingPayload({
    restaurantId,
    clientId,
    zNr,
    sessionOpenedAt: session.opened_at,
    sessionClosedAt: closedAt,
    businessDate,
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

  const { error: sessionError } = await admin
    .from("pos_register_sessions")
    .update({
      closed_at: closedAt,
      closing_cash_cents: closingCashCents,
      expected_cash_cents: expectedCashCents,
      cash_difference_cents: cashDifferenceCents,
      closed_by_profile_id: params.closedByProfileId ?? null,
      z_nr: zNr,
      cash_point_closing_id: closingId,
      dsfinvk_business_date: businessDate,
    })
    .eq("id", session.id);

  if (sessionError) {
    return { ok: false, error: sessionError.message, status: 500 };
  }

  const { error: saveError } = await admin
    .from("pos_restaurant_fiscal_config")
    .update({
      register_opened_at: null,
      current_register_session_id: null,
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
    sessionId: session.id,
    closingId,
    zNr,
    state: waited.state,
    closedAt,
    expectedCashCents,
    closingCashCents,
    cashDifferenceCents,
  };
}

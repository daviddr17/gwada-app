import "server-only";

import { randomBytes } from "node:crypto";
import {
  fiskalyAuthToken,
  formatFiskalyHttpError,
  normalizeFiskalySignDeBaseUrl,
} from "@/lib/pos/fiskaly-auth";
import { upsertDsfinvkCashRegister } from "@/lib/pos/fiskaly-dsfinvk";
import { fetchPlatformFiskalySecretsAdmin } from "@/lib/supabase/platform-fiskaly-secrets-db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const TSS_DEPLOY_TIMEOUT_MS = 45_000;

export type FiskalyProvisionStatus = "pending" | "ready" | "failed";

export type FiskalyProvisionResult =
  | {
      ok: true;
      restaurantId: string;
      tssId: string;
      clientId: string;
      clientSerial: string;
      dsfinvkCashRegisterReady?: boolean;
      skipped?: boolean;
      dsfinvkBackfillOnly?: boolean;
    }
  | { ok: false; restaurantId: string; error: string };

export type DsfinvkCashRegisterResult =
  | { ok: true; restaurantId: string; backfillOnly?: boolean }
  | { ok: false; restaurantId: string; error: string };

function generateAdminPin(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let pin = "";
  const bytes = randomBytes(8);
  for (let i = 0; i < 8; i++) {
    pin += chars[bytes[i]! % chars.length];
  }
  return pin;
}

/** Human-readable + globally unique Fiskaly client serial (max 70 chars). */
export function fiskalyClientSerialFromRestaurant(
  slug: string,
  restaurantId: string,
): string {
  const sanitized = slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const uniqueSuffix = restaurantId
    .replace(/-/g, "")
    .slice(0, 8)
    .toLowerCase();
  const serial = `gwada-${sanitized || "standort"}-${uniqueSuffix}`.slice(0, 70);
  return serial.replace(/[/_]/g, "-");
}

async function fiskalyFetch(
  url: string,
  init: RequestInit & { timeoutMs?: number },
): Promise<Response> {
  const timeoutMs = init.timeoutMs ?? 15_000;
  const { timeoutMs: _t, ...rest } = init;
  return fetch(url, {
    ...rest,
    signal: AbortSignal.timeout(timeoutMs),
  });
}

async function readFiskalyError(res: Response, label: string): Promise<string> {
  const body = await res.text();
  return `${label}: ${formatFiskalyHttpError(res.status, body)}`;
}

type FiskalyTssCreateResponse = {
  admin_puk?: string;
  state?: string;
};

export async function ensureRestaurantDsfinvkCashRegister(
  restaurantId: string,
): Promise<DsfinvkCashRegisterResult> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, restaurantId, error: "admin_unavailable" };
  }

  const platform = await fetchPlatformFiskalySecretsAdmin();
  if (!platform?.enabled || !platform.apiKey || !platform.apiSecret) {
    return { ok: false, restaurantId, error: "fiskaly_not_configured" };
  }

  const { data: existing } = await admin
    .from("pos_restaurant_fiscal_config")
    .select(
      "fiskaly_tss_id, fiskaly_client_id, dsfinvk_cash_register_ready, fiskaly_provision_status",
    )
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  const tssId = existing?.fiskaly_tss_id?.trim();
  const clientId = existing?.fiskaly_client_id?.trim();

  if (!tssId || !clientId) {
    return { ok: false, restaurantId, error: "fiskaly_tss_missing" };
  }

  if (existing?.dsfinvk_cash_register_ready) {
    return { ok: true, restaurantId, backfillOnly: true };
  }

  const registerResult = await upsertDsfinvkCashRegister({
    dsfinvkBaseUrl: platform.dsfinvkBaseUrl,
    apiKey: platform.apiKey,
    apiSecret: platform.apiSecret,
    clientId,
    tssId,
  });

  if (!registerResult.ok) {
    await admin.from("pos_restaurant_fiscal_config").upsert(
      {
        restaurant_id: restaurantId,
        fiskaly_provision_error: registerResult.error.slice(0, 2000),
      },
      { onConflict: "restaurant_id" },
    );
    return { ok: false, restaurantId, error: registerResult.error };
  }

  const { error: saveError } = await admin
    .from("pos_restaurant_fiscal_config")
    .update({
      dsfinvk_cash_register_ready: true,
      fiskaly_provision_error: null,
    })
    .eq("restaurant_id", restaurantId);

  if (saveError) {
    return { ok: false, restaurantId, error: saveError.message };
  }

  return { ok: true, restaurantId };
}

export async function provisionRestaurantFiskaly(
  restaurantId: string,
): Promise<FiskalyProvisionResult> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, restaurantId, error: "admin_unavailable" };
  }

  const platform = await fetchPlatformFiskalySecretsAdmin();
  if (!platform?.enabled || !platform.apiKey || !platform.apiSecret) {
    return { ok: false, restaurantId, error: "fiskaly_not_configured" };
  }

  const { data: restaurant, error: restaurantError } = await admin
    .from("restaurants")
    .select("id, slug, name")
    .eq("id", restaurantId)
    .maybeSingle();

  if (restaurantError || !restaurant) {
    return { ok: false, restaurantId, error: "restaurant_not_found" };
  }

  const { data: existing } = await admin
    .from("pos_restaurant_fiscal_config")
    .select(
      "fiskaly_provision_status, fiskaly_tss_id, fiskaly_client_id, fiskaly_client_serial, dsfinvk_cash_register_ready",
    )
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (
    existing?.fiskaly_provision_status === "ready" &&
    existing.fiskaly_tss_id?.trim() &&
    existing.fiskaly_client_id?.trim()
  ) {
    if (existing.dsfinvk_cash_register_ready) {
      return {
        ok: true,
        restaurantId,
        tssId: existing.fiskaly_tss_id,
        clientId: existing.fiskaly_client_id,
        clientSerial: existing.fiskaly_client_serial ?? "",
        dsfinvkCashRegisterReady: true,
        skipped: true,
      };
    }

    const dsfinvk = await ensureRestaurantDsfinvkCashRegister(restaurantId);
    if (!dsfinvk.ok) {
      return {
        ok: false,
        restaurantId,
        error: dsfinvk.error,
      };
    }

    return {
      ok: true,
      restaurantId,
      tssId: existing.fiskaly_tss_id,
      clientId: existing.fiskaly_client_id,
      clientSerial: existing.fiskaly_client_serial ?? "",
      dsfinvkCashRegisterReady: true,
      skipped: true,
      dsfinvkBackfillOnly: true,
    };
  }

  await admin.from("pos_restaurant_fiscal_config").upsert(
    {
      restaurant_id: restaurantId,
      fiskaly_enabled: false,
      fiskaly_provision_status: "pending",
      fiskaly_provision_error: null,
    },
    { onConflict: "restaurant_id" },
  );

  const signBase = normalizeFiskalySignDeBaseUrl(platform.signDeBaseUrl);
  const tssId = crypto.randomUUID();
  const clientId = crypto.randomUUID();
  const clientSerial = fiskalyClientSerialFromRestaurant(
    restaurant.slug ?? restaurant.id,
    restaurant.id,
  );
  const adminPin = generateAdminPin();

  try {
    const token = await fiskalyAuthToken(
      signBase,
      platform.apiKey,
      platform.apiSecret,
    );
    const authHeaders = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const createRes = await fiskalyFetch(`${signBase}/tss/${tssId}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({
        description: `Gwada ${restaurant.name}`.slice(0, 100),
      }),
    });

    if (!createRes.ok) {
      throw new Error(await readFiskalyError(createRes, "TSS create"));
    }

    const created = (await createRes.json()) as FiskalyTssCreateResponse;
    const adminPuk = created.admin_puk?.trim();
    if (!adminPuk) {
      throw new Error("TSS create: admin_puk missing in response");
    }

    const deployRes = await fiskalyFetch(`${signBase}/tss/${tssId}`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ state: "UNINITIALIZED" }),
      timeoutMs: TSS_DEPLOY_TIMEOUT_MS,
    });

    if (!deployRes.ok) {
      throw new Error(await readFiskalyError(deployRes, "TSS deploy"));
    }

    const pinRes = await fiskalyFetch(`${signBase}/tss/${tssId}/admin`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({
        admin_puk: adminPuk,
        new_admin_pin: adminPin,
      }),
    });

    if (!pinRes.ok) {
      throw new Error(await readFiskalyError(pinRes, "TSS admin PIN"));
    }

    const adminAuthRes = await fiskalyFetch(
      `${signBase}/tss/${tssId}/admin/auth`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ admin_pin: adminPin }),
      },
    );

    if (!adminAuthRes.ok) {
      throw new Error(await readFiskalyError(adminAuthRes, "TSS admin auth"));
    }

    const initRes = await fiskalyFetch(`${signBase}/tss/${tssId}`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ state: "INITIALIZED" }),
      timeoutMs: TSS_DEPLOY_TIMEOUT_MS,
    });

    if (!initRes.ok) {
      throw new Error(await readFiskalyError(initRes, "TSS initialize"));
    }

    const clientRes = await fiskalyFetch(
      `${signBase}/tss/${tssId}/client/${clientId}`,
      {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ serial_number: clientSerial }),
      },
    );

    if (!clientRes.ok) {
      throw new Error(await readFiskalyError(clientRes, "Client create"));
    }

    const registerResult = await upsertDsfinvkCashRegister({
      dsfinvkBaseUrl: platform.dsfinvkBaseUrl,
      apiKey: platform.apiKey,
      apiSecret: platform.apiSecret,
      clientId,
      tssId,
    });

    if (!registerResult.ok) {
      throw new Error(`DSFinV-K cash register: ${registerResult.error}`);
    }

    const now = new Date().toISOString();
    const { error: saveError } = await admin
      .from("pos_restaurant_fiscal_config")
      .upsert(
        {
          restaurant_id: restaurantId,
          fiskaly_enabled: true,
          fiskaly_tss_id: tssId,
          fiskaly_client_id: clientId,
          fiskaly_client_serial: clientSerial,
          fiskaly_provision_status: "ready",
          fiskaly_provision_error: null,
          fiskaly_provisioned_at: now,
          dsfinvk_cash_register_ready: true,
        },
        { onConflict: "restaurant_id" },
      );

    if (saveError) {
      throw new Error(saveError.message);
    }

    return {
      ok: true,
      restaurantId,
      tssId,
      clientId,
      clientSerial,
      dsfinvkCashRegisterReady: true,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "fiskaly_provision_failed";

    await admin.from("pos_restaurant_fiscal_config").upsert(
      {
        restaurant_id: restaurantId,
        fiskaly_enabled: false,
        fiskaly_provision_status: "failed",
        fiskaly_provision_error: message.slice(0, 2000),
      },
      { onConflict: "restaurant_id" },
    );

    console.error("[pos] Fiskaly provision", restaurantId, err);
    return { ok: false, restaurantId, error: message };
  }
}

export async function ensureRestaurantFiskalyProvisioned(
  restaurantId: string,
): Promise<FiskalyProvisionResult> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, restaurantId, error: "admin_unavailable" };
  }

  const { data: existing } = await admin
    .from("pos_restaurant_fiscal_config")
    .select(
      "fiskaly_provision_status, fiskaly_tss_id, fiskaly_client_id, fiskaly_client_serial, dsfinvk_cash_register_ready",
    )
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (
    existing?.fiskaly_provision_status === "ready" &&
    existing.fiskaly_tss_id?.trim() &&
    existing.fiskaly_client_id?.trim()
  ) {
    if (!existing.dsfinvk_cash_register_ready) {
      const dsfinvk = await ensureRestaurantDsfinvkCashRegister(restaurantId);
      if (!dsfinvk.ok) {
        return { ok: false, restaurantId, error: dsfinvk.error };
      }
    }

    return {
      ok: true,
      restaurantId,
      tssId: existing.fiskaly_tss_id,
      clientId: existing.fiskaly_client_id,
      clientSerial: existing.fiskaly_client_serial ?? "",
      dsfinvkCashRegisterReady: true,
      skipped: true,
    };
  }

  return provisionRestaurantFiskaly(restaurantId);
}

export async function provisionAllRestaurantsFiskaly(): Promise<{
  total: number;
  ready: number;
  failed: number;
  results: FiskalyProvisionResult[];
}> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { total: 0, ready: 0, failed: 0, results: [] };
  }

  const { data: restaurants, error } = await admin
    .from("restaurants")
    .select("id");

  if (error || !restaurants?.length) {
    return { total: 0, ready: 0, failed: 0, results: [] };
  }

  const results: FiskalyProvisionResult[] = [];
  let ready = 0;
  let failed = 0;

  for (const row of restaurants) {
    const result = await provisionRestaurantFiskaly(row.id);
    results.push(result);
    if (result.ok) ready += 1;
    else failed += 1;
  }

  return {
    total: restaurants.length,
    ready,
    failed,
    results,
  };
}

export async function countFiskalyProvisionStats(): Promise<{
  totalRestaurants: number;
  ready: number;
  failed: number;
  pending: number;
  cashRegisterReady: number;
  cashRegisterMissing: number;
}> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      totalRestaurants: 0,
      ready: 0,
      failed: 0,
      pending: 0,
      cashRegisterReady: 0,
      cashRegisterMissing: 0,
    };
  }

  const [{ count: totalRestaurants }, { data: configs }] = await Promise.all([
    admin.from("restaurants").select("id", { count: "exact", head: true }),
    admin
      .from("pos_restaurant_fiscal_config")
      .select("fiskaly_provision_status, dsfinvk_cash_register_ready"),
  ]);

  let ready = 0;
  let failed = 0;
  let pending = 0;
  let cashRegisterReady = 0;
  let cashRegisterMissing = 0;

  for (const row of configs ?? []) {
    if (row.fiskaly_provision_status === "ready") {
      ready += 1;
      if (row.dsfinvk_cash_register_ready) cashRegisterReady += 1;
      else cashRegisterMissing += 1;
    } else if (row.fiskaly_provision_status === "failed") failed += 1;
    else if (row.fiskaly_provision_status === "pending") pending += 1;
  }

  const total = totalRestaurants ?? 0;
  const unprovisioned = Math.max(0, total - ready - failed - pending);

  return {
    totalRestaurants: total,
    ready,
    failed,
    pending: pending + unprovisioned,
    cashRegisterReady,
    cashRegisterMissing,
  };
}

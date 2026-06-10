import "server-only";

import { randomBytes } from "node:crypto";
import {
  fiskalyAuthToken,
  formatFiskalyHttpError,
  normalizeFiskalySignDeBaseUrl,
} from "@/lib/pos/fiskaly-auth";
import {
  germanFiskalyProvisionError,
  suggestsFiskalyReconcile,
} from "@/lib/pos/fiskaly-error-messages";
import { upsertDsfinvkCashRegister } from "@/lib/pos/fiskaly-dsfinvk";
import type {
  FiskalyBulkProvisionResult,
  FiskalyProvisionLocation,
  FiskalyProvisionResult,
  FiskalyProvisionResultFailure,
  FiskalyProvisionResultSuccess,
} from "@/lib/pos/fiskaly-provision-types";
import {
  fiskalyClientSerialFromRestaurant,
  formatFiskalyLocationLabel,
} from "@/lib/pos/fiskaly-provision-serial";
import { findFiskalyClientBySerial } from "@/lib/pos/fiskaly-reconcile";
import { fetchPlatformFiskalySecretsAdmin } from "@/lib/supabase/platform-fiskaly-secrets-db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const TSS_DEPLOY_TIMEOUT_MS = 45_000;

export type { FiskalyProvisionStatus } from "@/lib/pos/fiskaly-provision-types";
export type {
  FiskalyProvisionLocation,
  FiskalyProvisionOutcome,
  FiskalyProvisionResult,
} from "@/lib/pos/fiskaly-provision-types";

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

export { fiskalyClientSerialFromRestaurant, formatFiskalyLocationLabel } from "@/lib/pos/fiskaly-provision-serial";

function failureResult(
  restaurantId: string,
  error: string,
): FiskalyProvisionResultFailure {
  return {
    ok: false,
    restaurantId,
    outcome: "failed",
    error,
    errorLabel: germanFiskalyProvisionError(error),
    suggestReconcile: suggestsFiskalyReconcile(error),
  };
}

function successResult(
  input: Omit<FiskalyProvisionResultSuccess, "ok">,
): FiskalyProvisionResultSuccess {
  return { ok: true, ...input };
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

async function fiskalyResourceExists(
  url: string,
  headers: Record<string, string>,
): Promise<boolean> {
  const res = await fiskalyFetch(url, { method: "GET", headers });
  return res.ok;
}

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
      fiskaly_provision_status: "ready",
      fiskaly_enabled: true,
    })
    .eq("restaurant_id", restaurantId);

  if (saveError) {
    return { ok: false, restaurantId, error: saveError.message };
  }

  return { ok: true, restaurantId };
}

async function savePartialProvision(
  restaurantId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  await admin.from("pos_restaurant_fiscal_config").upsert(
    { restaurant_id: restaurantId, ...patch },
    { onConflict: "restaurant_id" },
  );
}

export async function provisionRestaurantFiskaly(
  restaurantId: string,
): Promise<FiskalyProvisionResult> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return failureResult(restaurantId, "admin_unavailable");
  }

  const platform = await fetchPlatformFiskalySecretsAdmin();
  if (!platform?.enabled || !platform.apiKey || !platform.apiSecret) {
    return failureResult(restaurantId, "fiskaly_not_configured");
  }

  const { data: restaurant, error: restaurantError } = await admin
    .from("restaurants")
    .select("id, slug, name")
    .eq("id", restaurantId)
    .maybeSingle();

  if (restaurantError || !restaurant) {
    return failureResult(restaurantId, "restaurant_not_found");
  }

  const clientSerial = fiskalyClientSerialFromRestaurant(
    restaurant.slug ?? restaurant.id,
    restaurant.id,
  );

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
      return successResult({
        restaurantId,
        outcome: "skipped_ready",
        tssId: existing.fiskaly_tss_id,
        clientId: existing.fiskaly_client_id,
        clientSerial: existing.fiskaly_client_serial ?? clientSerial,
        dsfinvkCashRegisterReady: true,
      });
    }

    const dsfinvk = await ensureRestaurantDsfinvkCashRegister(restaurantId);
    if (!dsfinvk.ok) {
      return failureResult(restaurantId, dsfinvk.error);
    }

    return successResult({
      restaurantId,
      outcome: "dsfinvk_backfill",
      tssId: existing.fiskaly_tss_id,
      clientId: existing.fiskaly_client_id,
      clientSerial: existing.fiskaly_client_serial ?? clientSerial,
      dsfinvkCashRegisterReady: true,
    });
  }

  await savePartialProvision(restaurantId, {
    fiskaly_enabled: false,
    fiskaly_provision_status: "pending",
    fiskaly_provision_error: null,
    fiskaly_client_serial: clientSerial,
  });

  const signBase = normalizeFiskalySignDeBaseUrl(platform.signDeBaseUrl);
  const tssId = existing?.fiskaly_tss_id?.trim() || crypto.randomUUID();
  const clientId = existing?.fiskaly_client_id?.trim() || crypto.randomUUID();
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

    const tssExists = await fiskalyResourceExists(
      `${signBase}/tss/${tssId}`,
      authHeaders,
    );

    if (!tssExists) {
      const createRes = await fiskalyFetch(`${signBase}/tss/${tssId}`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({
          description: `Gwada ${restaurant.name}`.slice(0, 100),
        }),
      });

      if (!createRes.ok) {
        const err = await readFiskalyError(createRes, "TSS create");
        if (/E_TSS_CONFLICT/i.test(err) && existing?.fiskaly_tss_id) {
          // continue with stored id
        } else {
          throw new Error(err);
        }
      } else {
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
      }
    }

    await savePartialProvision(restaurantId, {
      fiskaly_tss_id: tssId,
      fiskaly_provision_status: "pending",
      fiskaly_client_serial: clientSerial,
    });

    const clientExists = await fiskalyResourceExists(
      `${signBase}/tss/${tssId}/client/${clientId}`,
      authHeaders,
    );

    if (!clientExists) {
      const clientRes = await fiskalyFetch(
        `${signBase}/tss/${tssId}/client/${clientId}`,
        {
          method: "PUT",
          headers: authHeaders,
          body: JSON.stringify({ serial_number: clientSerial }),
        },
      );

      if (!clientRes.ok) {
        const err = await readFiskalyError(clientRes, "Client create");
        const remote = await findFiskalyClientBySerial(clientSerial);
        if (remote) {
          throw new Error(
            `${err} — Bei Fiskaly existiert bereits Client ${remote.clientId} (Serien-Nr. ${remote.clientSerial}). Bitte „Abgleichen“ nutzen.`,
          );
        }
        throw new Error(err);
      }
    }

    await savePartialProvision(restaurantId, {
      fiskaly_tss_id: tssId,
      fiskaly_client_id: clientId,
      fiskaly_client_serial: clientSerial,
      fiskaly_provision_status: "pending",
    });

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
    const wasPartial =
      Boolean(existing?.fiskaly_tss_id) || Boolean(existing?.fiskaly_client_id);

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

    return successResult({
      restaurantId,
      outcome: wasPartial ? "dsfinvk_backfill" : "created",
      tssId,
      clientId,
      clientSerial,
      dsfinvkCashRegisterReady: true,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "fiskaly_provision_failed";

    await savePartialProvision(restaurantId, {
      fiskaly_enabled: false,
      fiskaly_provision_status: "failed",
      fiskaly_provision_error: message.slice(0, 2000),
      fiskaly_tss_id: tssId,
      fiskaly_client_id: clientId,
      fiskaly_client_serial: clientSerial,
    });

    console.error("[pos] Fiskaly provision", restaurantId, err);
    return failureResult(restaurantId, message);
  }
}

export async function ensureRestaurantFiskalyProvisioned(
  restaurantId: string,
): Promise<FiskalyProvisionResult> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return failureResult(restaurantId, "admin_unavailable");
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
        return failureResult(restaurantId, dsfinvk.error);
      }
    }

    return successResult({
      restaurantId,
      outcome: "skipped_ready",
      tssId: existing.fiskaly_tss_id,
      clientId: existing.fiskaly_client_id,
      clientSerial: existing.fiskaly_client_serial ?? "",
      dsfinvkCashRegisterReady: true,
    });
  }

  return provisionRestaurantFiskaly(restaurantId);
}

export async function provisionRestaurantsFiskaly(
  restaurantIds?: string[],
): Promise<FiskalyBulkProvisionResult> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { total: 0, ready: 0, failed: 0, results: [] };
  }

  let ids = restaurantIds?.filter(Boolean) ?? [];
  if (!ids.length) {
    const { data: restaurants, error } = await admin
      .from("restaurants")
      .select("id");
    if (error || !restaurants?.length) {
      return { total: 0, ready: 0, failed: 0, results: [] };
    }
    ids = restaurants.map((r) => r.id);
  }

  const results: FiskalyProvisionResult[] = [];
  let ready = 0;
  let failed = 0;

  for (const id of ids) {
    const result = await provisionRestaurantFiskaly(id);
    results.push(result);
    if (result.ok) ready += 1;
    else failed += 1;
  }

  return { total: ids.length, ready, failed, results };
}

export async function provisionAllRestaurantsFiskaly(): Promise<FiskalyBulkProvisionResult> {
  return provisionRestaurantsFiskaly();
}

export async function listFiskalyProvisionLocations(options?: {
  checkRemote?: boolean;
}): Promise<FiskalyProvisionLocation[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];

  const { data: restaurants, error } = await admin
    .from("restaurants")
    .select("id, slug, name, city, country, address_line1")
    .order("name");

  if (error || !restaurants?.length) return [];

  const ids = restaurants.map((r) => r.id);
  const { data: configs } = await admin
    .from("pos_restaurant_fiscal_config")
    .select(
      "restaurant_id, fiskaly_provision_status, fiskaly_provision_error, fiskaly_tss_id, fiskaly_client_id, fiskaly_client_serial, dsfinvk_cash_register_ready",
    )
    .in("restaurant_id", ids);

  const configByRestaurant = new Map(
    (configs ?? []).map((c) => [c.restaurant_id as string, c]),
  );

  const locations: FiskalyProvisionLocation[] = [];

  for (const restaurant of restaurants) {
    const config = configByRestaurant.get(restaurant.id);
    const expectedClientSerial = fiskalyClientSerialFromRestaurant(
      restaurant.slug ?? restaurant.id,
      restaurant.id,
    );
    const provisionError = config?.fiskaly_provision_error?.trim() ?? null;

    let fiskalyRemote = null;
    if (options?.checkRemote) {
      const match = await findFiskalyClientBySerial(expectedClientSerial);
      if (match) fiskalyRemote = match;
    }

    locations.push({
      restaurantId: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug ?? "",
      city: restaurant.city ?? null,
      country: restaurant.country ?? null,
      addressLine1: restaurant.address_line1 ?? null,
      locationLabel: formatFiskalyLocationLabel(restaurant),
      provisionStatus:
        (config?.fiskaly_provision_status as FiskalyProvisionLocation["provisionStatus"]) ??
        null,
      provisionError,
      provisionErrorLabel: provisionError
        ? germanFiskalyProvisionError(provisionError)
        : null,
      suggestReconcile: suggestsFiskalyReconcile(provisionError),
      tssId: config?.fiskaly_tss_id?.trim() ?? null,
      clientId: config?.fiskaly_client_id?.trim() ?? null,
      clientSerial: config?.fiskaly_client_serial?.trim() ?? null,
      expectedClientSerial,
      dsfinvkCashRegisterReady: Boolean(config?.dsfinvk_cash_register_ready),
      fiskalyRemote,
    });
  }

  return locations;
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

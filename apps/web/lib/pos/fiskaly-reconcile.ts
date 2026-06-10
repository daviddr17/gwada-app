import "server-only";

import {
  fiskalyAuthToken,
  formatFiskalyHttpError,
  normalizeFiskalySignDeBaseUrl,
} from "@/lib/pos/fiskaly-auth";
import { fiskalyClientSerialFromRestaurant } from "@/lib/pos/fiskaly-provision-serial";
import type { FiskalyRemoteClientMatch } from "@/lib/pos/fiskaly-provision-types";
import { fetchPlatformFiskalySecretsAdmin } from "@/lib/supabase/platform-fiskaly-secrets-db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type FiskalyListTssResponse = {
  data?: Array<{ _id?: string; state?: string }>;
};

type FiskalyListClientsResponse = {
  data?: Array<{
    _id?: string;
    serial_number?: string;
    state?: string;
  }>;
};

type FiskalyClientResponse = {
  serial_number?: string;
  state?: string;
};

async function signDeAuthHeaders(signBase: string, apiKey: string, apiSecret: string) {
  const token = await fiskalyAuthToken(signBase, apiKey, apiSecret);
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function fiskalyGetJson<T>(
  url: string,
  headers: Record<string, string>,
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  const res = await fetch(url, {
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const body = await res.text();
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: formatFiskalyHttpError(res.status, body),
    };
  }
  try {
    return { ok: true, data: JSON.parse(body || "{}") as T };
  } catch {
    return { ok: false, status: res.status, error: "invalid_json" };
  }
}

/** Search Fiskaly SIGN DE for a client with the given serial (read-only). */
export async function findFiskalyClientBySerial(
  expectedSerial: string,
): Promise<FiskalyRemoteClientMatch | null> {
  const platform = await fetchPlatformFiskalySecretsAdmin();
  if (!platform?.enabled || !platform.apiKey || !platform.apiSecret) {
    return null;
  }

  const signBase = normalizeFiskalySignDeBaseUrl(platform.signDeBaseUrl);
  const headers = await signDeAuthHeaders(
    signBase,
    platform.apiKey,
    platform.apiSecret,
  );

  const tssList = await fiskalyGetJson<FiskalyListTssResponse>(
    `${signBase}/tss?limit=100`,
    headers,
  );
  if (!tssList.ok) return null;

  for (const tss of tssList.data.data ?? []) {
    const tssId = tss._id?.trim();
    if (!tssId) continue;

    const clients = await fiskalyGetJson<FiskalyListClientsResponse>(
      `${signBase}/tss/${tssId}/client?limit=100`,
      headers,
    );
    if (!clients.ok) continue;

    for (const client of clients.data.data ?? []) {
      const serial = client.serial_number?.trim();
      if (serial !== expectedSerial) continue;
      const clientId = client._id?.trim();
      if (!clientId) continue;

      return {
        found: true,
        tssId,
        clientId,
        clientSerial: serial,
        tssState: tss.state ?? null,
        clientState: client.state ?? null,
      };
    }
  }

  return null;
}

export async function getFiskalyClientAtTss(
  tssId: string,
  clientId: string,
): Promise<FiskalyRemoteClientMatch | null> {
  const platform = await fetchPlatformFiskalySecretsAdmin();
  if (!platform?.enabled || !platform.apiKey || !platform.apiSecret) {
    return null;
  }

  const signBase = normalizeFiskalySignDeBaseUrl(platform.signDeBaseUrl);
  const headers = await signDeAuthHeaders(
    signBase,
    platform.apiKey,
    platform.apiSecret,
  );

  const [tssRes, clientRes] = await Promise.all([
    fiskalyGetJson<{ state?: string }>(`${signBase}/tss/${tssId}`, headers),
    fiskalyGetJson<FiskalyClientResponse>(
      `${signBase}/tss/${tssId}/client/${clientId}`,
      headers,
    ),
  ]);

  if (!clientRes.ok) return null;

  const serial = clientRes.data.serial_number?.trim();
  if (!serial) return null;

  return {
    found: true,
    tssId,
    clientId,
    clientSerial: serial,
    tssState: tssRes.ok ? (tssRes.data.state ?? null) : null,
    clientState: clientRes.data.state ?? null,
  };
}

export async function previewFiskalyReconcile(restaurantId: string): Promise<
  | {
      ok: true;
      restaurantId: string;
      restaurantName: string;
      expectedClientSerial: string;
      match: FiskalyRemoteClientMatch | null;
    }
  | { ok: false; error: string }
> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "admin_unavailable" };

  const { data: restaurant } = await admin
    .from("restaurants")
    .select("id, slug, name")
    .eq("id", restaurantId)
    .maybeSingle();

  if (!restaurant) return { ok: false, error: "restaurant_not_found" };

  const expectedClientSerial = fiskalyClientSerialFromRestaurant(
    restaurant.slug ?? restaurant.id,
    restaurant.id,
  );

  const match = await findFiskalyClientBySerial(expectedClientSerial);

  return {
    ok: true,
    restaurantId,
    restaurantName: restaurant.name,
    expectedClientSerial,
    match,
  };
}

export async function linkFiskalyExistingClient(params: {
  restaurantId: string;
  tssId: string;
  clientId: string;
  clientSerial: string;
}): Promise<
  | { ok: true; restaurantId: string; outcome: "linked_existing" }
  | { ok: false; error: string }
> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "admin_unavailable" };

  const remote = await getFiskalyClientAtTss(params.tssId, params.clientId);
  if (!remote) {
    return { ok: false, error: "fiskaly_client_not_found" };
  }

  const now = new Date().toISOString();
  const { error: saveError } = await admin.from("pos_restaurant_fiscal_config").upsert(
    {
      restaurant_id: params.restaurantId,
      fiskaly_enabled: true,
      fiskaly_tss_id: params.tssId,
      fiskaly_client_id: params.clientId,
      fiskaly_client_serial: params.clientSerial,
      fiskaly_provision_status: "pending",
      fiskaly_provision_error: null,
    },
    { onConflict: "restaurant_id" },
  );

  if (saveError) return { ok: false, error: saveError.message };

  const { ensureRestaurantDsfinvkCashRegister } = await import(
    "@/lib/pos/fiskaly-provision"
  );
  const dsfinvk = await ensureRestaurantDsfinvkCashRegister(params.restaurantId);
  if (!dsfinvk.ok) {
    await admin.from("pos_restaurant_fiscal_config").upsert(
      {
        restaurant_id: params.restaurantId,
        fiskaly_provision_status: "failed",
        fiskaly_provision_error: dsfinvk.error.slice(0, 2000),
      },
      { onConflict: "restaurant_id" },
    );
    return { ok: false, error: dsfinvk.error };
  }

  const { error: readyError } = await admin
    .from("pos_restaurant_fiscal_config")
    .update({
      fiskaly_provision_status: "ready",
      fiskaly_provision_error: null,
      fiskaly_provisioned_at: now,
      fiskaly_enabled: true,
    })
    .eq("restaurant_id", params.restaurantId);

  if (readyError) return { ok: false, error: readyError.message };

  return { ok: true, restaurantId: params.restaurantId, outcome: "linked_existing" };
}

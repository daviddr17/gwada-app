import "server-only";

import {
  adyenApiBases,
  adyenOnboardingRedirectUrl,
  restaurantCountryIso2,
} from "@/lib/integrations/adyen-connect";
import {
  adyenConfigFromJson,
  adyenPlatformSecretsReady,
  type AdyenPlatformEnv,
} from "@/lib/integrations/platform-adyen-config";
import { platformApiFetchSignal } from "@/lib/integrations/platform-api-timeout";
import { getPublicSiteUrl } from "@/lib/public-env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isPlatformIntegrationEnabledAdmin } from "@/lib/supabase/platform-integration-enabled";
import {
  fetchRestaurantAdyenConnectionAdmin,
  saveRestaurantAdyenConnectionAdmin,
  type AdyenConnectionRow,
} from "@/lib/supabase/restaurant-adyen-connection-db";

export type AdyenPlatformSecrets = {
  env: AdyenPlatformEnv;
  lemApiKey: string;
  balancePlatformApiKey: string;
};

export async function getAdyenPlatformSecretsAdmin(): Promise<AdyenPlatformSecrets | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("platform_integrations")
    .select("config")
    .eq("key", "adyen")
    .maybeSingle();
  const config = adyenConfigFromJson(data?.config);
  if (!adyenPlatformSecretsReady(config)) return null;
  return {
    env: config.env === "live" ? "live" : "test",
    lemApiKey: config.lem_api_key!,
    balancePlatformApiKey: config.balance_platform_api_key!,
  };
}

export async function getAdyenPlatformReadyAdmin(): Promise<AdyenPlatformSecrets | null> {
  if (!(await isPlatformIntegrationEnabledAdmin("adyen"))) return null;
  return getAdyenPlatformSecretsAdmin();
}

export function adyenOnboardingReturnUrl(req: Request, restaurantId: string): string {
  const path = `/api/integrations/adyen/return?${new URLSearchParams({ restaurantId })}`;
  const site = getPublicSiteUrl();
  if (site) return `${site}${path}`;
  return `${new URL(req.url).origin}${path}`;
}

type AdyenError = { error: string };

async function adyenPost(params: {
  url: string;
  apiKey: string;
  idempotencyKey: string;
  body: Record<string, unknown>;
}): Promise<{ id: string } | AdyenError | { json: Record<string, unknown> }> {
  const res = await fetch(params.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": params.apiKey,
      "Idempotency-Key": params.idempotencyKey,
    },
    body: JSON.stringify(params.body),
    cache: "no-store",
    signal: platformApiFetchSignal(),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return { error: safeAdyenDetail(json) };
  }
  return { json };
}

function safeAdyenDetail(json: Record<string, unknown>): string {
  const detail =
    typeof json.detail === "string"
      ? json.detail
      : typeof json.title === "string"
        ? json.title
        : "";
  if (!detail || /api[_ -]?key|AQE/i.test(detail)) {
    return "Adyen hat die Weiterleitung abgelehnt.";
  }
  return `Adyen hat die Weiterleitung abgelehnt. ${detail}`.slice(0, 200);
}

function idFrom(result: { json: Record<string, unknown> } | AdyenError | { id: string }): string | AdyenError {
  if ("error" in result) return result;
  if ("id" in result && !("json" in result)) return result.id;
  const payload = "json" in result ? result.json : undefined;
  const id =
    payload &&
    typeof payload === "object" &&
    "id" in payload &&
    typeof payload.id === "string"
      ? payload.id.trim()
      : "";
  if (!id) return { error: "Adyen hat keine Konto-Kennung zurückgegeben." };
  return id;
}

async function loadRestaurantLegalName(restaurantId: string): Promise<{
  legalName: string;
  country: string;
} | { error: string }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { error: "server_misconfigured" };
  const { data, error } = await admin
    .from("restaurants")
    .select("name, country, country_iso2")
    .eq("id", restaurantId)
    .maybeSingle();
  if (error || !data) return { error: "Restaurant nicht gefunden." };
  const row = data as {
    name?: string | null;
    country?: string | null;
    country_iso2?: string | null;
  };
  const legalName = row.name?.trim() || "Restaurant";
  return {
    legalName,
    country: restaurantCountryIso2(row.country_iso2, row.country),
  };
}

/**
 * Creates the platform resources if needed, then returns Adyen's hosted
 * onboarding URL. Does not create a payment.
 */
export async function createAdyenHostedOnboardingRedirect(params: {
  restaurantId: string;
  secrets: AdyenPlatformSecrets;
  returnUrl: string;
}): Promise<{ url: string } | { error: string }> {
  const bases = adyenApiBases(params.secrets.env);
  const existing = await fetchRestaurantAdyenConnectionAdmin(params.restaurantId);
  if (existing.error) return { error: existing.error };

  const sameEnv = existing.row?.env === params.secrets.env;
  let legalEntityId = sameEnv ? existing.row?.legal_entity_id ?? null : null;
  let accountHolderId = sameEnv ? existing.row?.account_holder_id ?? null : null;
  let balanceAccountId = sameEnv ? existing.row?.balance_account_id ?? null : null;

  const profile = await loadRestaurantLegalName(params.restaurantId);
  if ("error" in profile) return profile;

  const persist = async (
    patch: Partial<AdyenConnectionRow> & { status?: "disconnected" | "connected" },
  ) => {
    const saved = await saveRestaurantAdyenConnectionAdmin({
      restaurantId: params.restaurantId,
      status: "disconnected",
      env: params.secrets.env,
      legalName: profile.legalName,
      legalEntityId,
      accountHolderId,
      balanceAccountId,
      connectedAt: null,
      ...patch,
    });
    return saved.error;
  };

  if (!legalEntityId) {
    const created = await adyenPost({
      url: `${bases.lem}/legalEntities`,
      apiKey: params.secrets.lemApiKey,
      idempotencyKey: `le-${params.restaurantId}-${params.secrets.env}`,
      body: {
        type: "organization",
        organization: {
          legalName: profile.legalName,
          registeredAddress: { country: profile.country },
        },
      },
    });
    const id = idFrom(created);
    if (typeof id !== "string") return id;
    legalEntityId = id;
    const error = await persist({});
    if (error) return { error };
  }

  if (!accountHolderId) {
    const created = await adyenPost({
      url: `${bases.balance}/accountHolders`,
      apiKey: params.secrets.balancePlatformApiKey,
      idempotencyKey: `ah-${params.restaurantId}-${params.secrets.env}`,
      body: {
        legalEntityId,
        description: profile.legalName,
        reference: params.restaurantId,
        capabilities: {
          receivePayments: { requested: true },
        },
      },
    });
    const id = idFrom(created);
    if (typeof id !== "string") return id;
    accountHolderId = id;
    const error = await persist({});
    if (error) return { error };
  }

  if (!balanceAccountId) {
    const created = await adyenPost({
      url: `${bases.balance}/balanceAccounts`,
      apiKey: params.secrets.balancePlatformApiKey,
      idempotencyKey: `ba-${params.restaurantId}-${params.secrets.env}`,
      body: {
        accountHolderId,
        description: profile.legalName,
      },
    });
    const id = idFrom(created);
    if (typeof id !== "string") return id;
    balanceAccountId = id;
    const error = await persist({});
    if (error) return { error };
  }

  const link = await adyenPost({
    url: `${bases.lem}/legalEntities/${encodeURIComponent(legalEntityId)}/onboardingLinks`,
    apiKey: params.secrets.lemApiKey,
    idempotencyKey: `ol-${params.restaurantId}-${Date.now()}`,
    body: {
      redirectUrl: params.returnUrl,
      locale: "de-DE",
      settings: {
        changeLegalEntityType: true,
        editPrefilledCountry: true,
      },
    },
  });
  if ("error" in link) return link;
  const url = adyenOnboardingRedirectUrl("json" in link ? link.json : null);
  if (!url) return { error: "Adyen hat keinen Onboarding-Link geliefert." };
  return { url };
}

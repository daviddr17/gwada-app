import "server-only";

import {
  MOLLIE_CONNECT_SCOPES,
  buildMollieAuthorizeUrl,
} from "@/lib/integrations/mollie-connect";
import {
  mollieConfigFromJson,
  molliePlatformSecretsReady,
} from "@/lib/integrations/platform-mollie-config";
import { platformApiFetchSignal } from "@/lib/integrations/platform-api-timeout";
import { getPublicSiteUrl } from "@/lib/public-env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isPlatformIntegrationEnabledAdmin } from "@/lib/supabase/platform-integration-enabled";

const MOLLIE_TOKEN_URL = "https://api.mollie.com/oauth2/tokens";

export type MolliePlatformSecrets = {
  clientId: string;
  clientSecret: string;
};

export async function getMolliePlatformSecretsAdmin(): Promise<MolliePlatformSecrets | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("platform_integrations")
    .select("config")
    .eq("key", "mollie")
    .maybeSingle();
  const config = mollieConfigFromJson(data?.config);
  if (!molliePlatformSecretsReady(config)) return null;
  return {
    clientId: config.client_id!,
    clientSecret: config.client_secret!,
  };
}

export async function getMolliePlatformReadyAdmin(): Promise<MolliePlatformSecrets | null> {
  if (!(await isPlatformIntegrationEnabledAdmin("mollie"))) return null;
  return getMolliePlatformSecretsAdmin();
}

export function mollieOAuthCallbackUrl(req: Request): string {
  const path = "/api/integrations/mollie/callback";
  const site = getPublicSiteUrl();
  if (site) return `${site}${path}`;
  return `${new URL(req.url).origin}${path}`;
}

export function mollieAuthorizeRedirect(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  return buildMollieAuthorizeUrl(params);
}

export type MollieTokenResult = {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number | null;
  scope: string;
};

export async function exchangeMollieAuthorizationCode(params: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}): Promise<MollieTokenResult | { error: string }> {
  const res = await fetch(MOLLIE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: params.code,
      redirect_uri: params.redirectUri,
      client_id: params.clientId,
      client_secret: params.clientSecret,
    }),
    cache: "no-store",
    signal: platformApiFetchSignal(),
  });
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !body.access_token) {
    return { error: "mollie_token_rejected" };
  }
  return {
    accessToken: body.access_token,
    refreshToken:
      typeof body.refresh_token === "string" && body.refresh_token.trim()
        ? body.refresh_token.trim()
        : null,
    expiresIn: typeof body.expires_in === "number" ? body.expires_in : null,
    scope: body.scope?.trim() || MOLLIE_CONNECT_SCOPES.join(" "),
  };
}

export async function fetchMollieOrganization(accessToken: string): Promise<{
  id: string | null;
  name: string | null;
}> {
  const res = await fetch("https://api.mollie.com/v2/organizations/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: platformApiFetchSignal(),
  });
  if (!res.ok) return { id: null, name: null };
  const body = (await res.json().catch(() => ({}))) as {
    id?: string;
    name?: string;
  };
  return {
    id: typeof body.id === "string" ? body.id : null,
    name: typeof body.name === "string" ? body.name.trim() || null : null,
  };
}

export async function fetchMollieProfileId(
  accessToken: string,
): Promise<string | null> {
  const res = await fetch("https://api.mollie.com/v2/profiles", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: platformApiFetchSignal(),
  });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => ({}))) as {
    _embedded?: {
      profiles?: Array<{ id?: string; status?: string }>;
    };
  };
  const profiles = body._embedded?.profiles ?? [];
  const verified = profiles.find((p) => p.status === "verified" && p.id);
  const first = profiles.find((p) => p.id);
  return verified?.id ?? first?.id ?? null;
}

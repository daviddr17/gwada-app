import "server-only";

import { GOOGLE_BUSINESS_OAUTH_SCOPE_IDS } from "@/lib/constants/integration-oauth-scopes";
import { isPlatformIntegrationEnabledAdmin } from "@/lib/supabase/platform-integration-enabled";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  oauthConfigFromJson,
  type GoogleBusinessIntegrationConfig,
} from "@/lib/integrations/oauth-integration-types";
import { getPublicSiteUrl } from "@/lib/public-env";

export type GoogleBusinessPlatformConfig = {
  clientId: string;
  clientSecret: string;
};

export async function getGoogleBusinessPlatformConfigAdmin(): Promise<GoogleBusinessPlatformConfig | null> {
  if (!(await isPlatformIntegrationEnabledAdmin("google_business"))) {
    return null;
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const { data } = await admin
    .from("platform_integrations")
    .select("config")
    .eq("key", "google_business")
    .maybeSingle();

  if (!data) return null;
  const cfg = data.config as Record<string, unknown>;
  const clientId =
    typeof cfg.client_id === "string" ? cfg.client_id.trim() : "";
  const clientSecret =
    typeof cfg.client_secret === "string" ? cfg.client_secret.trim() : "";
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function googleBusinessOAuthCallbackUrl(req: Request): string {
  const site = getPublicSiteUrl();
  if (site) return `${site}/api/integrations/google-business/callback`;
  return `${new URL(req.url).origin}/api/integrations/google-business/callback`;
}

export function buildGoogleBusinessOAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const q = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: "code",
    scope: GOOGLE_BUSINESS_OAUTH_SCOPE_IDS.join(" "),
    state: params.state,
    access_type: "offline",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

export async function exchangeGoogleBusinessCode(params: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}): Promise<
  | {
      accessToken: string;
      refreshToken: string | null;
      scope: string;
    }
  | { error: string }
> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: params.code,
      client_id: params.clientId,
      client_secret: params.clientSecret,
      redirect_uri: params.redirectUri,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  const body = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !body.access_token) {
    return {
      error: body.error_description ?? body.error ?? `google_token_${res.status}`,
    };
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? null,
    scope: body.scope ?? "",
  };
}

export function parseGoogleGrantedScopes(scopeString: string): string[] {
  return scopeString
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function fetchGoogleBusinessAccount(params: {
  accessToken: string;
}): Promise<
  | {
      accountName: string;
      accountTitle: string;
      locationName?: string;
      locationTitle?: string;
    }
  | { error: string }
> {
  const headers = { Authorization: `Bearer ${params.accessToken}` };
  const accountsRes = await fetch(
    "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
    { headers, cache: "no-store" },
  );
  const accountsBody = (await accountsRes.json()) as {
    accounts?: Array<{ name: string; accountName?: string }>;
    error?: { message?: string };
  };
  if (!accountsRes.ok || !accountsBody.accounts?.length) {
    return {
      error:
        accountsBody.error?.message ??
        "Kein Google-Business-Konto gefunden.",
    };
  }
  const account = accountsBody.accounts[0]!;
  const accountName = account.name;
  const accountTitle = account.accountName ?? accountName;

  let locationName: string | undefined;
  let locationTitle: string | undefined;
  try {
    const locRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title`,
      { headers, cache: "no-store" },
    );
    const locBody = (await locRes.json()) as {
      locations?: Array<{ name: string; title?: string }>;
    };
    const loc = locBody.locations?.[0];
    if (loc) {
      locationName = loc.name;
      locationTitle = loc.title;
    }
  } catch {
    /* Standort optional */
  }

  return { accountName, accountTitle, locationName, locationTitle };
}

export function googleBusinessConfigFromJson(
  raw: unknown,
): GoogleBusinessIntegrationConfig {
  const base = oauthConfigFromJson<GoogleBusinessIntegrationConfig>(raw);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const o = raw as Record<string, unknown>;
  return {
    ...base,
    account_name: typeof o.account_name === "string" ? o.account_name : undefined,
    account_title:
      typeof o.account_title === "string" ? o.account_title : undefined,
    location_name:
      typeof o.location_name === "string" ? o.location_name : undefined,
    location_title:
      typeof o.location_title === "string" ? o.location_title : undefined,
    refresh_token:
      typeof o.refresh_token === "string" ? o.refresh_token : undefined,
    access_token:
      typeof o.access_token === "string" ? o.access_token : undefined,
  };
}

export {
  encodeOAuthState as encodeGoogleOAuthState,
  decodeOAuthState as decodeGoogleOAuthState,
} from "@/lib/integrations/meta-oauth-shared";

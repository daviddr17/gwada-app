import "server-only";

import { OUTLOOK_OAUTH_SCOPE_IDS } from "@/lib/constants/integration-oauth-scopes";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPublicSiteUrl } from "@/lib/public-env";
import type { SmtpIntegrationConfig } from "@/lib/integrations/smtp-integration-config";

export const OUTLOOK_SMTP_HOST = "smtp.office365.com";
export const OUTLOOK_SMTP_PORT = 587;
export const OUTLOOK_IMAP_HOST = "outlook.office365.com";
export const OUTLOOK_IMAP_PORT = 993;

const MS_AUTHORIZE =
  "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const MS_TOKEN = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

export type MicrosoftOAuthPlatformConfig = {
  clientId: string;
  clientSecret: string;
};

export type OutlookIntegrationConfig = SmtpIntegrationConfig & {
  auth_mode?: "outlook_oauth";
  refresh_token?: string;
  access_token?: string;
  granted_scopes?: string[];
};

export async function getMicrosoftOAuthPlatformSecretsAdmin(): Promise<MicrosoftOAuthPlatformConfig | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const { data } = await admin
    .from("platform_integrations")
    .select("config")
    .eq("key", "microsoft_oauth")
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

export async function getOutlookOAuthPlatformConfigAdmin(): Promise<MicrosoftOAuthPlatformConfig | null> {
  return getMicrosoftOAuthPlatformSecretsAdmin();
}

export function outlookOAuthCallbackUrl(req: Request): string {
  const site = getPublicSiteUrl();
  if (site) return `${site}/api/integrations/email/outlook/callback`;
  return `${new URL(req.url).origin}/api/integrations/email/outlook/callback`;
}

export function buildOutlookOAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const q = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: "code",
    scope: OUTLOOK_OAUTH_SCOPE_IDS.join(" "),
    state: params.state,
    response_mode: "query",
    prompt: "select_account",
  });
  return `${MS_AUTHORIZE}?${q}`;
}

export async function exchangeOutlookOAuthCode(params: {
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
  const res = await fetch(MS_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: params.code,
      client_id: params.clientId,
      client_secret: params.clientSecret,
      redirect_uri: params.redirectUri,
      grant_type: "authorization_code",
      scope: OUTLOOK_OAUTH_SCOPE_IDS.join(" "),
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
      error:
        body.error_description ?? body.error ?? `outlook_token_${res.status}`,
    };
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? null,
    scope: body.scope ?? "",
  };
}

export async function refreshOutlookAccessToken(params: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<{ accessToken: string } | { error: string }> {
  const res = await fetch(MS_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      refresh_token: params.refreshToken,
      grant_type: "refresh_token",
      scope: OUTLOOK_OAUTH_SCOPE_IDS.join(" "),
    }),
    cache: "no-store",
  });
  const body = (await res.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !body.access_token) {
    return {
      error:
        body.error_description ??
        body.error ??
        `outlook_refresh_${res.status}`,
    };
  }
  return { accessToken: body.access_token };
}

export async function fetchOutlookAccountEmail(params: {
  accessToken: string;
}): Promise<{ email: string } | { error: string }> {
  const res = await fetch(
    "https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName",
    {
      headers: { Authorization: `Bearer ${params.accessToken}` },
      cache: "no-store",
    },
  );
  const body = (await res.json()) as {
    mail?: string | null;
    userPrincipalName?: string | null;
    error?: { message?: string };
  };
  const email = (body.mail ?? body.userPrincipalName ?? "")
    .trim()
    .toLowerCase();
  if (!res.ok || !email.includes("@")) {
    return {
      error: body.error?.message ?? "outlook_email_missing",
    };
  }
  return { email };
}

export function outlookConfigFromJson(raw: unknown): OutlookIntegrationConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const str = (k: string) =>
    typeof o[k] === "string" ? (o[k] as string).trim() || undefined : undefined;
  const scopes = Array.isArray(o.granted_scopes)
    ? o.granted_scopes.filter((s): s is string => typeof s === "string")
    : undefined;
  return {
    auth_mode: o.auth_mode === "outlook_oauth" ? "outlook_oauth" : undefined,
    email: str("email") ?? str("from_email"),
    from_name: str("from_name"),
    refresh_token: str("refresh_token"),
    access_token: str("access_token"),
    granted_scopes: scopes,
    smtp_host: OUTLOOK_SMTP_HOST,
    smtp_port: OUTLOOK_SMTP_PORT,
    imap_host: OUTLOOK_IMAP_HOST,
    imap_port: OUTLOOK_IMAP_PORT,
  };
}

export function buildOutlookMailboxConfig(params: {
  email: string;
  fromName?: string | null;
  accessToken: string;
  refreshToken: string | null;
  grantedScopes: string[];
  existingRefreshToken?: string | null;
}): OutlookIntegrationConfig {
  return {
    auth_mode: "outlook_oauth",
    email: params.email,
    from_name: params.fromName?.trim() || undefined,
    access_token: params.accessToken,
    refresh_token:
      params.refreshToken?.trim() ||
      params.existingRefreshToken?.trim() ||
      undefined,
    granted_scopes:
      params.grantedScopes.length > 0
        ? params.grantedScopes
        : [...OUTLOOK_OAUTH_SCOPE_IDS],
    smtp_host: OUTLOOK_SMTP_HOST,
    smtp_port: OUTLOOK_SMTP_PORT,
    imap_host: OUTLOOK_IMAP_HOST,
    imap_port: OUTLOOK_IMAP_PORT,
  };
}

export {
  encodeOAuthState as encodeOutlookOAuthState,
  decodeOAuthState as decodeOutlookOAuthState,
} from "@/lib/integrations/meta-oauth-shared";

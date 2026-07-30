import "server-only";

import { GMAIL_OAUTH_SCOPE_IDS } from "@/lib/constants/integration-oauth-scopes";
import {
  getGoogleOAuthPlatformSecretsAdmin,
  type GoogleOAuthPlatformConfig,
} from "@/lib/integrations/google-platform-oauth";
import { getPublicSiteUrl } from "@/lib/public-env";
import type { SmtpIntegrationConfig } from "@/lib/integrations/smtp-integration-config";

export const GMAIL_SMTP_HOST = "smtp.gmail.com";
export const GMAIL_SMTP_PORT = 465;
export const GMAIL_IMAP_HOST = "imap.gmail.com";
export const GMAIL_IMAP_PORT = 993;

export type GmailIntegrationConfig = SmtpIntegrationConfig & {
  auth_mode?: "gmail_oauth";
  refresh_token?: string;
  access_token?: string;
  granted_scopes?: string[];
};

export async function getGmailOAuthPlatformConfigAdmin(): Promise<GoogleOAuthPlatformConfig | null> {
  return getGoogleOAuthPlatformSecretsAdmin();
}

export function gmailOAuthCallbackUrl(req: Request): string {
  const site = getPublicSiteUrl();
  if (site) return `${site}/api/integrations/email/gmail/callback`;
  return `${new URL(req.url).origin}/api/integrations/email/gmail/callback`;
}

export function buildGmailOAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const q = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: "code",
    scope: GMAIL_OAUTH_SCOPE_IDS.join(" "),
    state: params.state,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

export async function exchangeGmailOAuthCode(params: {
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
      error: body.error_description ?? body.error ?? `gmail_token_${res.status}`,
    };
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? null,
    scope: body.scope ?? "",
  };
}

export async function refreshGmailAccessToken(params: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<{ accessToken: string } | { error: string }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      refresh_token: params.refreshToken,
      grant_type: "refresh_token",
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
      error: body.error_description ?? body.error ?? `gmail_refresh_${res.status}`,
    };
  }
  return { accessToken: body.access_token };
}

export async function fetchGmailAccountEmail(params: {
  accessToken: string;
}): Promise<{ email: string } | { error: string }> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${params.accessToken}` },
    cache: "no-store",
  });
  const body = (await res.json()) as {
    email?: string;
    error?: { message?: string };
  };
  const email = body.email?.trim().toLowerCase();
  if (!res.ok || !email || !email.includes("@")) {
    return {
      error: body.error?.message ?? "gmail_email_missing",
    };
  }
  return { email };
}

export function gmailConfigFromJson(raw: unknown): GmailIntegrationConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const str = (k: string) =>
    typeof o[k] === "string" ? (o[k] as string).trim() || undefined : undefined;
  const scopes = Array.isArray(o.granted_scopes)
    ? o.granted_scopes.filter((s): s is string => typeof s === "string")
    : undefined;
  return {
    auth_mode: o.auth_mode === "gmail_oauth" ? "gmail_oauth" : undefined,
    email: str("email") ?? str("from_email"),
    from_name: str("from_name"),
    refresh_token: str("refresh_token"),
    access_token: str("access_token"),
    granted_scopes: scopes,
    smtp_host: GMAIL_SMTP_HOST,
    smtp_port: GMAIL_SMTP_PORT,
    imap_host: GMAIL_IMAP_HOST,
    imap_port: GMAIL_IMAP_PORT,
  };
}

export function buildGmailMailboxConfig(params: {
  email: string;
  fromName?: string | null;
  accessToken: string;
  refreshToken: string | null;
  grantedScopes: string[];
  existingRefreshToken?: string | null;
}): GmailIntegrationConfig {
  return {
    auth_mode: "gmail_oauth",
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
        : [...GMAIL_OAUTH_SCOPE_IDS],
    smtp_host: GMAIL_SMTP_HOST,
    smtp_port: GMAIL_SMTP_PORT,
    imap_host: GMAIL_IMAP_HOST,
    imap_port: GMAIL_IMAP_PORT,
  };
}

export {
  encodeOAuthState as encodeGmailOAuthState,
  decodeOAuthState as decodeGmailOAuthState,
} from "@/lib/integrations/meta-oauth-shared";

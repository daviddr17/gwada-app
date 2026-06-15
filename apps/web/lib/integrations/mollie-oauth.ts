import "server-only";

import { encodeOAuthState } from "@/lib/integrations/meta-oauth-shared";
import { getPublicSiteUrl } from "@/lib/public-env";
import { fetchPlatformMollieConfigAdmin } from "@/lib/supabase/platform-mollie-secrets-db";

export function mollieOAuthCallbackUrl(req: Request): string {
  const site = getPublicSiteUrl();
  if (site) return `${site}/api/integrations/mollie/callback`;
  return `${new URL(req.url).origin}/api/integrations/mollie/callback`;
}

export function buildMollieOAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const q = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: "code",
    scope: "payments.read payments.write organizations.read profiles.read",
    state: params.state,
  });
  return `https://my.mollie.com/oauth2/authorize?${q}`;
}

export async function getMolliePlatformOAuthAdmin(): Promise<{
  clientId: string;
  clientSecret: string;
} | null> {
  const cfg = await fetchPlatformMollieConfigAdmin();
  if (!cfg.enabled || !cfg.clientId || !cfg.clientSecret) return null;
  return { clientId: cfg.clientId, clientSecret: cfg.clientSecret };
}

export function encodeMollieOAuthState(restaurantId: string): string {
  return encodeOAuthState({ restaurantId });
}

export async function exchangeMollieOAuthCode(params: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}): Promise<
  | {
      accessToken: string;
      refreshToken: string | null;
      expiresIn: number | null;
    }
  | { error: string }
> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
    client_id: params.clientId,
    client_secret: params.clientSecret,
  });

  const res = await fetch("https://api.mollie.com/oauth2/tokens", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !json.access_token) {
    return {
      error: json.error_description ?? json.error ?? "token_exchange_failed",
    };
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresIn: json.expires_in ?? null,
  };
}

export async function refreshMollieAccessToken(params: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<
  | { accessToken: string; refreshToken: string | null; expiresIn: number | null }
  | { error: string }
> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: params.refreshToken,
    client_id: params.clientId,
    client_secret: params.clientSecret,
  });

  const res = await fetch("https://api.mollie.com/oauth2/tokens", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !json.access_token) {
    return {
      error: json.error_description ?? json.error ?? "token_refresh_failed",
    };
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? params.refreshToken,
    expiresIn: json.expires_in ?? null,
  };
}

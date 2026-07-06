import "server-only";

import { getPublicSiteUrl } from "@/lib/public-env";
import { APP_ROUTES } from "@/lib/navigation/app-routes";
import type { FacebookPlatformConfig } from "@/lib/integrations/platform-facebook-config";

const GRAPH_VERSION = "v22.0";

export const FACEBOOK_MESSENGER_SCOPES = [
  "pages_show_list",
  "pages_messaging",
  "pages_manage_metadata",
  "pages_read_engagement",
].join(",");

export function facebookOAuthCallbackUrl(req: Request): string {
  const site = getPublicSiteUrl();
  if (site) return `${site}/api/integrations/facebook/callback`;
  return `${new URL(req.url).origin}/api/integrations/facebook/callback`;
}

export function encodeFacebookOAuthState(payload: {
  restaurantId: string;
}): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeFacebookOAuthState(
  state: string,
): { restaurantId: string } | null {
  try {
    const raw = Buffer.from(state, "base64url").toString("utf8");
    const parsed = JSON.parse(raw) as { restaurantId?: string };
    if (!parsed.restaurantId || typeof parsed.restaurantId !== "string") {
      return null;
    }
    return { restaurantId: parsed.restaurantId };
  } catch {
    return null;
  }
}

export function buildFacebookOAuthUrl(params: {
  appId: string;
  redirectUri: string;
  state: string;
}): string {
  const q = new URLSearchParams({
    client_id: params.appId,
    redirect_uri: params.redirectUri,
    state: params.state,
    scope: FACEBOOK_MESSENGER_SCOPES,
    response_type: "code",
  });
  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${q}`;
}

export async function exchangeFacebookCodeForToken(params: {
  appId: string;
  appSecret: string;
  redirectUri: string;
  code: string;
}): Promise<{ accessToken: string } | { error: string }> {
  const q = new URLSearchParams({
    client_id: params.appId,
    client_secret: params.appSecret,
    redirect_uri: params.redirectUri,
    code: params.code,
  });
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token?${q}`;
  const res = await fetch(url, { cache: "no-store" });
  const body = (await res.json()) as {
    access_token?: string;
    error?: { message?: string };
  };
  if (!res.ok || !body.access_token) {
    return {
      error: body.error?.message ?? `facebook_token_${res.status}`,
    };
  }
  return { accessToken: body.access_token };
}

export type FacebookPageAccount = {
  id: string;
  name: string;
  access_token?: string;
};

export async function fetchFacebookPageAccounts(
  userAccessToken: string,
): Promise<{ pages: FacebookPageAccount[] } | { error: string }> {
  const q = new URLSearchParams({
    access_token: userAccessToken,
    fields: "id,name,access_token",
  });
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/me/accounts?${q}`;
  const res = await fetch(url, { cache: "no-store" });
  const body = (await res.json()) as {
    data?: FacebookPageAccount[];
    error?: { message?: string };
  };
  if (!res.ok) {
    return { error: body.error?.message ?? `facebook_pages_${res.status}` };
  }
  return { pages: body.data ?? [] };
}

export function pickFacebookPageForMessenger(
  pages: FacebookPageAccount[],
): FacebookPageAccount | null {
  const withToken = pages.filter((p) => p.access_token?.trim());
  if (withToken.length === 0) return null;
  return withToken[0] ?? null;
}

export function settingsIntegrationsUrl(
  params?: { facebook?: "connected" | "error"; message?: string },
): string {
  const base = APP_ROUTES.settings.integrations;
  if (!params) return base;
  const q = new URLSearchParams();
  if (params.facebook) q.set("facebook", params.facebook);
  if (params.message) q.set("message", params.message);
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}

export type FacebookIntegrationConfig = {
  page_id?: string;
  page_name?: string;
  page_access_token?: string;
  user_access_token?: string;
};

export function facebookIntegrationConfigFromJson(
  raw: unknown,
): FacebookIntegrationConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  return {
    page_id: typeof o.page_id === "string" ? o.page_id : undefined,
    page_name: typeof o.page_name === "string" ? o.page_name : undefined,
    page_access_token:
      typeof o.page_access_token === "string" ? o.page_access_token : undefined,
    user_access_token:
      typeof o.user_access_token === "string" ? o.user_access_token : undefined,
  };
}

export function assertFacebookPlatformReady(
  cfg: FacebookPlatformConfig | null,
): cfg is FacebookPlatformConfig {
  return Boolean(cfg?.appId && cfg?.appSecret);
}

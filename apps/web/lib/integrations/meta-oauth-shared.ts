import "server-only";

import { META_GRAPH_VERSION } from "@/lib/constants/integration-oauth-scopes";
import { readPlatformIntegrationEnabled } from "@/lib/supabase/platform-integration-enabled";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPublicSiteUrl } from "@/lib/public-env";

export type MetaPlatformConfig = {
  appId: string;
  appSecret: string;
  sourceKey: "facebook" | "instagram";
};

export async function getMetaPlatformConfigAdmin(
  preferKey: "facebook" | "instagram",
): Promise<MetaPlatformConfig | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const keys =
    preferKey === "instagram"
      ? (["instagram", "facebook"] as const)
      : (["facebook", "instagram"] as const);

  for (const key of keys) {
    const { data } = await admin
      .from("platform_integrations")
      .select("enabled, config, key")
      .eq("key", key)
      .maybeSingle();

    if (!data || !readPlatformIntegrationEnabled(data.enabled)) continue;
    const cfg = data.config as Record<string, unknown>;
    const appId =
      typeof cfg.client_id === "string" ? cfg.client_id.trim() : "";
    const appSecret =
      typeof cfg.client_secret === "string" ? cfg.client_secret.trim() : "";
    if (appId && appSecret) {
      return {
        appId,
        appSecret,
        sourceKey: key as "facebook" | "instagram",
      };
    }
  }
  return null;
}

export function metaOAuthCallbackUrl(
  req: Request,
  provider: "facebook" | "instagram",
): string {
  const path = `/api/integrations/${provider}/callback`;
  const site = getPublicSiteUrl();
  if (site) return `${site}${path}`;
  return `${new URL(req.url).origin}${path}`;
}

export function encodeOAuthState(payload: {
  restaurantId: string;
}): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeOAuthState(
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

export function buildMetaOAuthUrl(params: {
  appId: string;
  redirectUri: string;
  state: string;
  scopeIds: string[];
}): string {
  const q = new URLSearchParams({
    client_id: params.appId,
    redirect_uri: params.redirectUri,
    state: params.state,
    scope: params.scopeIds.join(","),
    response_type: "code",
  });
  return `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?${q}`;
}

export async function exchangeMetaCodeForToken(params: {
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
  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token?${q}`;
  const res = await fetch(url, { cache: "no-store" });
  const body = (await res.json()) as {
    access_token?: string;
    error?: { message?: string };
  };
  if (!res.ok || !body.access_token) {
    return {
      error: body.error?.message ?? `meta_token_${res.status}`,
    };
  }
  return { accessToken: body.access_token };
}

/** Erteilte Berechtigungen laut Meta (debug_token). */
export async function fetchMetaGrantedScopes(params: {
  appId: string;
  appSecret: string;
  userAccessToken: string;
}): Promise<string[]> {
  const appToken = `${params.appId}|${params.appSecret}`;
  const q = new URLSearchParams({
    input_token: params.userAccessToken,
    access_token: appToken,
  });
  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/debug_token?${q}`;
  const res = await fetch(url, { cache: "no-store" });
  const body = (await res.json()) as {
    data?: { scopes?: string[]; granular_scopes?: Array<{ scope: string }> };
  };
  const fromScopes = body.data?.scopes ?? [];
  const fromGranular =
    body.data?.granular_scopes?.map((g) => g.scope).filter(Boolean) ?? [];
  return [...new Set([...fromScopes, ...fromGranular])];
}

export type MetaPageAccount = {
  id: string;
  name: string;
  access_token?: string;
  instagram_business_account?: { id: string; username?: string };
};

export async function fetchMetaPageAccounts(
  userAccessToken: string,
): Promise<{ pages: MetaPageAccount[] } | { error: string }> {
  const q = new URLSearchParams({
    access_token: userAccessToken,
    fields: "id,name,access_token,instagram_business_account{id,username}",
  });
  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/me/accounts?${q}`;
  const res = await fetch(url, { cache: "no-store" });
  const body = (await res.json()) as {
    data?: MetaPageAccount[];
    error?: { message?: string };
  };
  if (!res.ok) {
    return { error: body.error?.message ?? `meta_pages_${res.status}` };
  }
  return { pages: body.data ?? [] };
}

export function metaPagesEligibleForMessenger(
  pages: MetaPageAccount[],
): MetaPageAccount[] {
  return pages.filter((p) => p.access_token?.trim());
}

export function metaPagesEligibleForInstagram(
  pages: MetaPageAccount[],
): MetaPageAccount[] {
  return pages.filter(
    (p) =>
      p.access_token?.trim() && p.instagram_business_account?.id?.trim(),
  );
}

export function pickMetaPageForMessenger(
  pages: MetaPageAccount[],
): MetaPageAccount | null {
  const withToken = metaPagesEligibleForMessenger(pages);
  if (withToken.length === 0) return null;
  return withToken[0] ?? null;
}

export function pickMetaPageForInstagram(
  pages: MetaPageAccount[],
): MetaPageAccount | null {
  const withIg = metaPagesEligibleForInstagram(pages);
  if (withIg.length > 0) return withIg[0] ?? null;
  return pickMetaPageForMessenger(pages);
}

export function settingsIntegrationsUrl(params?: {
  provider?: "facebook" | "instagram" | "google_business";
  result?: "connected" | "error" | "select_page" | "select_location";
  message?: string;
}): string {
  const base = "/settings/integrationen";
  if (!params?.provider) return base;
  const q = new URLSearchParams();
  q.set(params.provider, params.result ?? "connected");
  if (params.message) q.set("message", params.message);
  return `${base}?${q.toString()}`;
}

/** Response.redirect braucht absolute URLs (Next.js Production). */
export function absoluteSitePath(req: Request, path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const site = getPublicSiteUrl()?.replace(/\/+$/, "");
  if (site) return `${site}${normalized}`;
  return new URL(normalized, req.url).href;
}

/** Response.redirect liefert in Production immutable Headers — Set-Cookie nur so. */
export function redirectResponse(
  location: string,
  options?: { setCookie?: string | string[] },
): Response {
  const headers = new Headers({ Location: location });
  const cookies = options?.setCookie;
  if (cookies) {
    for (const c of Array.isArray(cookies) ? cookies : [cookies]) {
      headers.append("Set-Cookie", c);
    }
  }
  return new Response(null, { status: 302, headers });
}

export function redirectToSettingsIntegrations(
  req: Request,
  params?: Parameters<typeof settingsIntegrationsUrl>[0],
): Response {
  return redirectResponse(
    absoluteSitePath(req, settingsIntegrationsUrl(params)),
  );
}

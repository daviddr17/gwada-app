import {
  decodeOAuthState,
  redirectToSettingsIntegrations,
} from "@/lib/integrations/meta-oauth-shared";
import {
  exchangeMollieOAuthCode,
  getMolliePlatformOAuthAdmin,
  mollieOAuthCallbackUrl,
} from "@/lib/integrations/mollie-oauth";
import { mollieGetOrganization } from "@/lib/pos/mollie-api-client";
import { upsertRestaurantMollieIntegration } from "@/lib/supabase/restaurant-mollie-integration-db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code")?.trim();
  const stateRaw = searchParams.get("state")?.trim();
  const oauthError =
    searchParams.get("error_description") ?? searchParams.get("error");

  if (oauthError) {
    return redirectToSettingsIntegrations(req, {
      provider: "mollie",
      result: "error",
      message: String(oauthError).slice(0, 200),
    });
  }

  if (!code || !stateRaw) {
    return redirectToSettingsIntegrations(req, {
      provider: "mollie",
      result: "error",
      message: "missing_code",
    });
  }

  const state = decodeOAuthState(stateRaw);
  if (!state?.restaurantId) {
    return redirectToSettingsIntegrations(req, {
      provider: "mollie",
      result: "error",
      message: "invalid_state",
    });
  }

  const platformCfg = await getMolliePlatformOAuthAdmin();
  if (!platformCfg) {
    return redirectToSettingsIntegrations(req, {
      provider: "mollie",
      result: "error",
      message: "platform_not_configured",
    });
  }

  const redirectUri = mollieOAuthCallbackUrl(req);
  const tokenResult = await exchangeMollieOAuthCode({
    clientId: platformCfg.clientId,
    clientSecret: platformCfg.clientSecret,
    redirectUri,
    code,
  });

  if ("error" in tokenResult) {
    return redirectToSettingsIntegrations(req, {
      provider: "mollie",
      result: "error",
      message: tokenResult.error,
    });
  }

  const org = await mollieGetOrganization({ apiKey: tokenResult.accessToken });

  try {
    await upsertRestaurantMollieIntegration({
      restaurantId: state.restaurantId,
      status: "working",
      config: {
        access_token: tokenResult.accessToken,
        refresh_token: tokenResult.refreshToken ?? undefined,
        expires_at: tokenResult.expiresIn
          ? new Date(Date.now() + tokenResult.expiresIn * 1000).toISOString()
          : undefined,
        organization_id: org?.id,
        organization_name: org?.name,
      },
      displayName: org?.name ?? "Mollie",
    });
  } catch (err) {
    return redirectToSettingsIntegrations(req, {
      provider: "mollie",
      result: "error",
      message: err instanceof Error ? err.message : "save_failed",
    });
  }

  return redirectToSettingsIntegrations(req, {
    provider: "mollie",
    result: "connected",
  });
}

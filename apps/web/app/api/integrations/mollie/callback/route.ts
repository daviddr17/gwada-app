import { MOLLIE_CONNECT_SCOPES } from "@/lib/integrations/mollie-connect";
import {
  exchangeMollieAuthorizationCode,
  fetchMollieOrganization,
  fetchMollieProfileId,
  getMolliePlatformReadyAdmin,
  mollieOAuthCallbackUrl,
} from "@/lib/integrations/mollie-oauth";
import {
  decodeOAuthState,
  redirectToSettingsIntegrations,
} from "@/lib/integrations/meta-oauth-shared";
import { authorizeMollieRestaurantRoute } from "@/lib/integrations/oauth-route-auth";
import { saveRestaurantMollieConnectionAdmin } from "@/lib/supabase/restaurant-mollie-connection-db";

export const dynamic = "force-dynamic";

function fail(req: Request, message: string) {
  return redirectToSettingsIntegrations(req, {
    provider: "mollie",
    result: "error",
    message,
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code")?.trim();
  const stateRaw = searchParams.get("state")?.trim();
  const oauthError = searchParams.get("error");

  if (oauthError) {
    const message =
      oauthError === "access_denied"
        ? "Die Verbindung bei Mollie wurde abgebrochen."
        : "Die Verbindung mit Mollie ist fehlgeschlagen.";
    return fail(req, message);
  }

  const state = stateRaw ? decodeOAuthState(stateRaw) : null;
  if (!code || !state) return fail(req, "Die Rückkehr von Mollie war ungültig.");

  const auth = await authorizeMollieRestaurantRoute(state.restaurantId);
  if (!auth.ok) return fail(req, "Bitte erneut anmelden und Mollie noch einmal verbinden.");

  const platform = await getMolliePlatformReadyAdmin();
  if (!platform) return fail(req, "Die Mollie-Plattform-App ist nicht eingerichtet.");

  const token = await exchangeMollieAuthorizationCode({
    clientId: platform.clientId,
    clientSecret: platform.clientSecret,
    redirectUri: mollieOAuthCallbackUrl(req),
    code,
  });
  if ("error" in token) return fail(req, "Mollie hat die Verbindung abgelehnt.");

  const [org, profileId] = await Promise.all([
    fetchMollieOrganization(token.accessToken),
    fetchMollieProfileId(token.accessToken),
  ]);
  const expiresAt =
    token.expiresIn != null
      ? new Date(Date.now() + token.expiresIn * 1000).toISOString()
      : null;

  const saved = await saveRestaurantMollieConnectionAdmin({
    restaurantId: auth.ctx.restaurantId,
    organizationName: org.name,
    organizationId: org.id,
    profileId,
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    expiresAt,
    scope: token.scope || MOLLIE_CONNECT_SCOPES.join(" "),
  });
  if (saved.error) return fail(req, saved.error);

  return redirectToSettingsIntegrations(req, {
    provider: "mollie",
    result: "connected",
  });
}

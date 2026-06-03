import "server-only";

import {
  clearLegacyOAuthPendingCookieHeaders,
  oauthPendingIdCookieHeader,
  oauthPendingClearAllCookieHeaders,
} from "@/lib/integrations/oauth-pending-cookie";
import {
  createOAuthIntegrationPending,
  type OAuthPendingProvider,
} from "@/lib/integrations/oauth-pending-store";
import {
  absoluteSitePath,
  redirectResponse,
  settingsIntegrationsUrl,
} from "@/lib/integrations/meta-oauth-shared";

export { oauthPendingClearAllCookieHeaders };

export async function redirectToOAuthIntegrationSelection(
  req: Request,
  params: {
    provider: OAuthPendingProvider;
    restaurantId: string;
    payload: unknown;
    result: "select_page" | "select_location";
  },
): Promise<Response> {
  const created = await createOAuthIntegrationPending({
    provider: params.provider,
    restaurantId: params.restaurantId,
    payload: params.payload,
  });

  if ("error" in created) {
    return redirectResponse(
      absoluteSitePath(
        req,
        settingsIntegrationsUrl({
          provider: params.provider,
          result: "error",
          message: "server_misconfigured",
        }),
      ),
    );
  }

  const result =
    params.result === "select_location" ? "select_location" : "select_page";

  return redirectResponse(
    absoluteSitePath(
      req,
      settingsIntegrationsUrl({
        provider: params.provider,
        result,
      }),
    ),
    {
      setCookie: [
        oauthPendingIdCookieHeader(created.id),
        ...clearLegacyOAuthPendingCookieHeaders(),
      ],
    },
  );
}

export function redirectWithClearedOAuthPending(
  req: Request,
  params: Parameters<typeof settingsIntegrationsUrl>[0],
): Response {
  return redirectResponse(absoluteSitePath(req, settingsIntegrationsUrl(params)), {
    setCookie: oauthPendingClearAllCookieHeaders(),
  });
}

export function jsonResponseWithClearedOAuthPending(
  body: Record<string, unknown>,
): Response {
  const headers = new Headers({ "Content-Type": "application/json" });
  for (const c of oauthPendingClearAllCookieHeaders()) {
    headers.append("Set-Cookie", c);
  }
  return new Response(JSON.stringify(body), { status: 200, headers });
}

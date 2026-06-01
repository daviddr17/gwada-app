import "server-only";

import {
  clearMetaOAuthPendingCookieHeader,
  encodeMetaOAuthPending,
  metaOAuthPendingCookieHeader,
  type MetaOAuthPendingPayload,
} from "@/lib/integrations/meta-oauth-pending";
import {
  absoluteSitePath,
  redirectResponse,
  settingsIntegrationsUrl,
} from "@/lib/integrations/meta-oauth-shared";

export function redirectToMetaPageSelection(
  req: Request,
  payload: Omit<MetaOAuthPendingPayload, "exp">,
): Response {
  const token = encodeMetaOAuthPending(payload);
  if (!token) {
    return redirectResponse(
      absoluteSitePath(
        req,
        settingsIntegrationsUrl({
          provider: payload.provider,
          result: "error",
          message: "server_misconfigured",
        }),
      ),
    );
  }

  return redirectResponse(
    absoluteSitePath(
      req,
      settingsIntegrationsUrl({
        provider: payload.provider,
        result: "select_page",
      }),
    ),
    { setCookie: metaOAuthPendingCookieHeader(token) },
  );
}

export function redirectWithClearedMetaPending(
  req: Request,
  params: Parameters<typeof settingsIntegrationsUrl>[0],
): Response {
  return redirectResponse(
    absoluteSitePath(req, settingsIntegrationsUrl(params)),
    { setCookie: clearMetaOAuthPendingCookieHeader() },
  );
}

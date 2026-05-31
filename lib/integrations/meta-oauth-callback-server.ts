import "server-only";

import {
  clearMetaOAuthPendingCookieHeader,
  encodeMetaOAuthPending,
  metaOAuthPendingCookieHeader,
  type MetaOAuthPendingPayload,
} from "@/lib/integrations/meta-oauth-pending";
import { settingsIntegrationsUrl } from "@/lib/integrations/meta-oauth-shared";
import { getPublicSiteUrl } from "@/lib/public-env";

export function redirectToMetaPageSelection(
  payload: Omit<MetaOAuthPendingPayload, "exp">,
): Response {
  const token = encodeMetaOAuthPending(payload);
  if (!token) {
    return Response.redirect(
      settingsIntegrationsUrl({
        provider: payload.provider,
        result: "error",
        message: "server_misconfigured",
      }),
    );
  }

  const site = getPublicSiteUrl();
  const path = settingsIntegrationsUrl({
    provider: payload.provider,
    result: "select_page",
  });
  const url = site ? `${site}${path}` : path;
  const res = Response.redirect(url);
  res.headers.append("Set-Cookie", metaOAuthPendingCookieHeader(token));
  return res;
}

export function redirectWithClearedMetaPending(url: string): Response {
  const res = Response.redirect(url);
  res.headers.append("Set-Cookie", clearMetaOAuthPendingCookieHeader());
  return res;
}

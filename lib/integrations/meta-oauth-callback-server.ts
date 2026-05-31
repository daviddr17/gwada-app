import "server-only";

import {
  clearMetaOAuthPendingCookieHeader,
  encodeMetaOAuthPending,
  metaOAuthPendingCookieHeader,
  type MetaOAuthPendingPayload,
} from "@/lib/integrations/meta-oauth-pending";
import {
  absoluteSitePath,
  settingsIntegrationsUrl,
} from "@/lib/integrations/meta-oauth-shared";

export function redirectToMetaPageSelection(
  req: Request,
  payload: Omit<MetaOAuthPendingPayload, "exp">,
): Response {
  const token = encodeMetaOAuthPending(payload);
  if (!token) {
    return Response.redirect(
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

  const url = absoluteSitePath(
    req,
    settingsIntegrationsUrl({
      provider: payload.provider,
      result: "select_page",
    }),
  );
  const res = Response.redirect(url);
  res.headers.append("Set-Cookie", metaOAuthPendingCookieHeader(token));
  return res;
}

export function redirectWithClearedMetaPending(
  req: Request,
  params: Parameters<typeof settingsIntegrationsUrl>[0],
): Response {
  const res = Response.redirect(
    absoluteSitePath(req, settingsIntegrationsUrl(params)),
  );
  res.headers.append("Set-Cookie", clearMetaOAuthPendingCookieHeader());
  return res;
}

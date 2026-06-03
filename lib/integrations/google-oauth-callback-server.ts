import "server-only";

import {
  clearGoogleOAuthPendingCookieHeader,
  encodeGoogleOAuthPending,
  googleOAuthPendingCookieHeader,
  type GoogleOAuthPendingPayload,
} from "@/lib/integrations/google-oauth-pending";
import {
  absoluteSitePath,
  redirectResponse,
  settingsIntegrationsUrl,
} from "@/lib/integrations/meta-oauth-shared";

export function redirectToGoogleLocationSelection(
  req: Request,
  payload: Omit<GoogleOAuthPendingPayload, "exp">,
): Response {
  const token = encodeGoogleOAuthPending(payload);
  if (!token) {
    return redirectResponse(
      absoluteSitePath(
        req,
        settingsIntegrationsUrl({
          provider: "google_business",
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
        provider: "google_business",
        result: "select_location",
      }),
    ),
    { setCookie: googleOAuthPendingCookieHeader(token) },
  );
}

export function redirectWithClearedGooglePending(
  req: Request,
  params: Parameters<typeof settingsIntegrationsUrl>[0],
): Response {
  return redirectResponse(
    absoluteSitePath(req, settingsIntegrationsUrl(params)),
    { setCookie: clearGoogleOAuthPendingCookieHeader() },
  );
}

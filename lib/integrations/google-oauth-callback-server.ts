import "server-only";

import type { GoogleOAuthPendingPayload } from "@/lib/integrations/google-oauth-pending";
import {
  redirectToOAuthIntegrationSelection,
  redirectWithClearedOAuthPending,
} from "@/lib/integrations/oauth-pending-response";

export async function redirectToGoogleLocationSelection(
  req: Request,
  payload: Omit<GoogleOAuthPendingPayload, "exp">,
): Promise<Response> {
  return redirectToOAuthIntegrationSelection(req, {
    provider: "google_business",
    restaurantId: payload.restaurantId,
    payload,
    result: "select_location",
  });
}

export function redirectWithClearedGooglePending(
  req: Request,
  params: Parameters<typeof redirectWithClearedOAuthPending>[1],
): Response {
  return redirectWithClearedOAuthPending(req, params);
}

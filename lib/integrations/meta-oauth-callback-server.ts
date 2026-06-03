import "server-only";

import type { MetaOAuthPendingPayload } from "@/lib/integrations/meta-oauth-pending";
import {
  redirectToOAuthIntegrationSelection,
  redirectWithClearedOAuthPending,
} from "@/lib/integrations/oauth-pending-response";

export async function redirectToMetaPageSelection(
  req: Request,
  payload: Omit<MetaOAuthPendingPayload, "exp">,
): Promise<Response> {
  return redirectToOAuthIntegrationSelection(req, {
    provider: payload.provider,
    restaurantId: payload.restaurantId,
    payload,
    result: "select_page",
  });
}

export function redirectWithClearedMetaPending(
  req: Request,
  params: Parameters<typeof redirectWithClearedOAuthPending>[1],
): Response {
  return redirectWithClearedOAuthPending(req, params);
}

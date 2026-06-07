import "server-only";

import { readOAuthPendingIdFromRequest } from "@/lib/integrations/oauth-pending-cookie";
import {
  deleteOAuthIntegrationPending,
  loadOAuthIntegrationPending,
  type OAuthPendingProvider,
} from "@/lib/integrations/oauth-pending-store";
import type { GoogleOAuthPendingPayload } from "@/lib/integrations/google-oauth-pending";
import type { MetaOAuthPendingPayload } from "@/lib/integrations/meta-oauth-pending";

export async function loadMetaOAuthPendingFromRequest(
  req: Request,
  expectedProvider: "facebook" | "instagram",
): Promise<Omit<MetaOAuthPendingPayload, "exp"> | null> {
  const id = readOAuthPendingIdFromRequest(req);
  if (!id) return null;

  const loaded = await loadOAuthIntegrationPending<
    Omit<MetaOAuthPendingPayload, "exp">
  >(id);
  if (!loaded || loaded.row.provider !== expectedProvider) return null;

  return loaded.row.payload;
}

export async function loadGoogleOAuthPendingFromRequest(
  req: Request,
): Promise<Omit<GoogleOAuthPendingPayload, "exp"> | null> {
  const id = readOAuthPendingIdFromRequest(req);
  if (!id) return null;

  const loaded = await loadOAuthIntegrationPending<
    Omit<GoogleOAuthPendingPayload, "exp">
  >(id);
  if (!loaded || loaded.row.provider !== "google_business") return null;

  return loaded.row.payload;
}

export async function consumeOAuthPendingAfterComplete(
  req: Request,
  provider: OAuthPendingProvider,
): Promise<void> {
  const id = readOAuthPendingIdFromRequest(req);
  if (id) await deleteOAuthIntegrationPending(id);
}

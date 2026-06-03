import { finalizeGoogleBusinessIntegration } from "@/lib/integrations/google-business-finalize-server";
import type { GoogleBusinessLocationOption } from "@/lib/integrations/google-oauth-pending";
import {
  consumeOAuthPendingAfterComplete,
  loadGoogleOAuthPendingFromRequest,
} from "@/lib/integrations/oauth-pending-load";
import { jsonResponseWithClearedOAuthPending } from "@/lib/integrations/oauth-pending-response";
import { settingsIntegrationsUrl } from "@/lib/integrations/meta-oauth-shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { locationId?: string };
  try {
    body = (await req.json()) as { locationId?: string };
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const locationId = body.locationId?.trim();
  if (!locationId) {
    return Response.json({ error: "missing_location" }, { status: 400 });
  }

  const pending = await loadGoogleOAuthPendingFromRequest(req);
  if (!pending) {
    return Response.json({ error: "pending_not_found" }, { status: 404 });
  }

  const location = pending.locations.find(
    (loc) => `${loc.accountName}::${loc.locationName}` === locationId,
  );
  if (!location) {
    return Response.json({ error: "invalid_location" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const { error } = await finalizeGoogleBusinessIntegration(
    admin,
    pending.restaurantId,
    location as GoogleBusinessLocationOption,
    {
      accessToken: pending.accessToken,
      refreshToken: pending.refreshToken,
      grantedScopes: pending.grantedScopes,
    },
  );

  if (error) {
    return Response.json({ error }, { status: 500 });
  }

  await consumeOAuthPendingAfterComplete(req, "google_business");

  return jsonResponseWithClearedOAuthPending({
    ok: true,
    redirectTo: settingsIntegrationsUrl({
      provider: "google_business",
      result: "connected",
    }),
  });
}

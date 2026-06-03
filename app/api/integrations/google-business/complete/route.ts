import { finalizeGoogleBusinessIntegration } from "@/lib/integrations/google-business-finalize-server";
import {
  readGoogleOAuthPendingFromRequest,
  type GoogleBusinessLocationOption,
} from "@/lib/integrations/google-oauth-pending";
import { redirectWithClearedGooglePending } from "@/lib/integrations/google-oauth-callback-server";
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

  const pending = readGoogleOAuthPendingFromRequest(req);
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

  const redirectTo = redirectWithClearedGooglePending(
    req,
    { provider: "google_business", result: "connected" },
  ).headers.get("Location");

  return Response.json({
    ok: true,
    redirectTo: redirectTo ?? "/settings/integrationen?google_business=connected",
  });
}

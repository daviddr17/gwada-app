import {
  consumeOAuthPendingAfterComplete,
  loadMetaOAuthPendingFromRequest,
} from "@/lib/integrations/oauth-pending-load";
import { finalizeInstagramIntegration } from "@/lib/integrations/meta-oauth-finalize-server";
import {
  metaPagesEligibleForInstagram,
  settingsIntegrationsUrl,
} from "@/lib/integrations/meta-oauth-shared";
import { jsonResponseWithClearedOAuthPending } from "@/lib/integrations/oauth-pending-response";
import { authorizeInstagramRestaurantRoute } from "@/lib/integrations/oauth-route-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const pending = await loadMetaOAuthPendingFromRequest(req, "instagram");
  if (!pending) {
    return Response.json({ error: "pending_not_found" }, { status: 404 });
  }

  const auth = await authorizeInstagramRestaurantRoute(pending.restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  let pageId: string;
  try {
    const body = (await req.json()) as { pageId?: string };
    pageId = body.pageId?.trim() ?? "";
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!pageId) {
    return Response.json({ error: "missing_page_id" }, { status: 400 });
  }

  const page = metaPagesEligibleForInstagram(pending.pages).find(
    (p) => p.id === pageId,
  );
  if (!page) {
    return Response.json({ error: "invalid_page_id" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const { error } = await finalizeInstagramIntegration(
    admin,
    pending.restaurantId,
    page,
    pending.userAccessToken,
    pending.grantedScopes,
  );

  if (error) {
    return Response.json({ error }, { status: 500 });
  }

  await consumeOAuthPendingAfterComplete(req, "instagram");

  return jsonResponseWithClearedOAuthPending({
    ok: true,
    redirectTo: settingsIntegrationsUrl({
      provider: "instagram",
      result: "connected",
    }),
  });
}

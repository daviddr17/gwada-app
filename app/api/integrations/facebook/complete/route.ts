import {
  clearMetaOAuthPendingCookieHeader,
  readMetaOAuthPendingFromRequest,
} from "@/lib/integrations/meta-oauth-pending";
import { finalizeFacebookIntegration } from "@/lib/integrations/meta-oauth-finalize-server";
import {
  metaPagesEligibleForMessenger,
  settingsIntegrationsUrl,
} from "@/lib/integrations/meta-oauth-shared";
import { authorizeFacebookRestaurantRoute } from "@/lib/integrations/oauth-route-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const pending = readMetaOAuthPendingFromRequest(req);
  if (!pending || pending.provider !== "facebook") {
    return Response.json({ error: "pending_not_found" }, { status: 404 });
  }

  const auth = await authorizeFacebookRestaurantRoute(pending.restaurantId);
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

  const page = metaPagesEligibleForMessenger(pending.pages).find(
    (p) => p.id === pageId,
  );
  if (!page) {
    return Response.json({ error: "invalid_page_id" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const { error } = await finalizeFacebookIntegration(
    admin,
    pending.restaurantId,
    page,
    pending.userAccessToken,
    pending.grantedScopes,
  );

  if (error) {
    return Response.json({ error }, { status: 500 });
  }

  const path = settingsIntegrationsUrl({
    provider: "facebook",
    result: "connected",
  });
  return new Response(JSON.stringify({ ok: true, redirectTo: path }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": clearMetaOAuthPendingCookieHeader(),
    },
  });
}

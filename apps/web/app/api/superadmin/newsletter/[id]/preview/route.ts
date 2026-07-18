import { assertSuperadminApi } from "@/lib/superadmin/assert-superadmin-api";
import { buildNewsletterPreviewHtml } from "@/lib/newsletter/newsletter-send-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPublicSupabaseUrl } from "@/lib/public-env";
import { resolvePublicAppOrigin } from "@/lib/navigation/request-origin";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }
  const supabaseUrl = getPublicSupabaseUrl();
  if (!supabaseUrl) {
    return Response.json({ error: "supabase_url_missing" }, { status: 503 });
  }
  const { id } = await ctx.params;
  const locale = new URL(req.url).searchParams.get("locale") ?? undefined;

  try {
    const preview = await buildNewsletterPreviewHtml({
      admin,
      newsletterId: id,
      supabaseUrl,
      locale,
      origin: resolvePublicAppOrigin(req),
    });
    if (!preview) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    return Response.json(preview);
  } catch (e) {
    const message = e instanceof Error ? e.message : "preview_failed";
    return Response.json({ error: message }, { status: 500 });
  }
}

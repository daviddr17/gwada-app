import { assertSuperadminApi } from "@/lib/superadmin/assert-superadmin-api";
import { sendNewsletterTestEmail } from "@/lib/newsletter/newsletter-send-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPublicSupabaseUrl } from "@/lib/public-env";
import { resolvePublicAppOrigin } from "@/lib/navigation/request-origin";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
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
  let body: { toEmail?: string; locale?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.toEmail?.trim()) {
    return Response.json({ error: "to_email_required" }, { status: 400 });
  }

  try {
    await sendNewsletterTestEmail({
      admin,
      newsletterId: id,
      toEmail: body.toEmail,
      locale: body.locale,
      supabaseUrl,
      origin: resolvePublicAppOrigin(req),
    });
    return Response.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "test_failed";
    return Response.json({ error: message }, { status: 500 });
  }
}

import { assertSuperadminApi } from "@/lib/superadmin/assert-superadmin-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { duplicatePlatformNewsletter } from "@/lib/supabase/platform-newsletter-db";

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
  const { id } = await ctx.params;
  let asTemplate = false;
  try {
    const body = (await req.json()) as { asTemplate?: boolean };
    asTemplate = Boolean(body.asTemplate);
  } catch {
    /* empty body ok */
  }

  try {
    const newId = await duplicatePlatformNewsletter(admin, id, {
      asTemplate,
      createdBy: auth.userId,
    });
    return Response.json({ id: newId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "duplicate_failed";
    return Response.json({ error: message }, { status: 500 });
  }
}

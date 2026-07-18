import { assertSuperadminApi } from "@/lib/superadmin/assert-superadmin-api";
import { enqueueNewsletterSend } from "@/lib/newsletter/newsletter-send-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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
  let body: { scheduledAt?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const sendAt =
    body.scheduledAt?.trim() ? new Date(body.scheduledAt) : new Date();
  if (Number.isNaN(sendAt.getTime())) {
    return Response.json({ error: "invalid_scheduled_at" }, { status: 400 });
  }

  try {
    const result = await enqueueNewsletterSend({
      admin,
      newsletterId: id,
      sendAt,
    });
    return Response.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "schedule_failed";
    const status =
      message === "no_subscribers" ||
      message === "subject_required" ||
      message === "blocks_required" ||
      message === "already_sending_or_sent" ||
      message === "template_cannot_send"
        ? 409
        : 500;
    return Response.json({ error: message }, { status });
  }
}

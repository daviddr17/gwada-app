import {
  parseLexofficeWebhookPayload,
  verifyLexofficeWebhookSignature,
} from "@/lib/integrations/lexoffice-webhook-verify";
import { dispatchLexofficeWebhook } from "@/lib/integrations/lexoffice-webhook-handler";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-lxo-signature");

  if (!(await verifyLexofficeWebhookSignature(rawBody, signature))) {
    return Response.json({ error: "invalid_signature" }, { status: 401 });
  }

  const payload = parseLexofficeWebhookPayload(rawBody);
  if (!payload) {
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const result = await dispatchLexofficeWebhook(admin, payload);
  if (!result.ok) {
    return Response.json(result, { status: 404 });
  }

  return Response.json({ ok: true });
}

import {
  handleWahaInboundWebhook,
  verifyWahaWebhookHmac,
  type WahaWebhookBody,
} from "@/lib/integrations/waha-inbound-webhook";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const hmac = req.headers.get("x-webhook-hmac");

  if (!verifyWahaWebhookHmac(rawBody, hmac)) {
    return Response.json({ error: "invalid_hmac" }, { status: 401 });
  }

  let body: WahaWebhookBody;
  try {
    body = JSON.parse(rawBody) as WahaWebhookBody;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const result = await handleWahaInboundWebhook(admin, body);
  if (!result.ok) {
    return Response.json(result, { status: 422 });
  }

  return Response.json(result);
}

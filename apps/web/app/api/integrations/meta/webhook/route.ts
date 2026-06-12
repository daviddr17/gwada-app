import {
  handleMetaMessagingWebhook,
  verifyMetaWebhookSignature,
  type MetaWebhookBody,
} from "@/lib/integrations/meta-messaging-webhook-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Meta Webhook — GET für Verifikation, POST für Events. Pull-Inbox bleibt parallel aktiv. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN?.trim();
  if (
    mode === "subscribe" &&
    verifyToken &&
    token === verifyToken &&
    challenge
  ) {
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  if (!verifyMetaWebhookSignature(rawBody, signature)) {
    return Response.json({ error: "invalid_signature" }, { status: 401 });
  }

  let body: MetaWebhookBody;
  try {
    body = JSON.parse(rawBody) as MetaWebhookBody;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const result = await handleMetaMessagingWebhook(admin, body);
  return Response.json({
    ok: result.ok,
    processed: result.processed,
    reason: result.reason,
  });
}

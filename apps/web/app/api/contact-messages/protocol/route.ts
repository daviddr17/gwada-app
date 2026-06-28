import { authorizeContactMessageProtocol } from "@/lib/contact-messages/contact-message-protocol-route-auth";
import { loadContactMessageProtocol } from "@/lib/contact-messages/contact-message-protocol-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId =
    new URL(req.url).searchParams.get("restaurantId")?.trim() ?? "";
  const messageId = new URL(req.url).searchParams.get("messageId")?.trim() ?? "";

  if (!messageId) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeContactMessageProtocol(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const result = await loadContactMessageProtocol(admin, {
    restaurantId: auth.restaurantId,
    messageId,
  });

  if (result.error) {
    const status = result.error === "not_found" ? 404 : 500;
    return Response.json({ error: result.error }, { status });
  }

  return Response.json(result.data);
}

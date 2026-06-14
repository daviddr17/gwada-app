import {
  fetchMetaMediaProxyResponse,
  parseMetaMediaProxyRequest,
} from "@/lib/contact-messages/meta-media-proxy-server";
import { authorizeContactMessagesRestaurant } from "@/lib/contact-messages/route-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Proxied Meta-Anhänge (Graph-URLs brauchen Page-Token). */
export async function GET(req: Request) {
  const parsed = parseMetaMediaProxyRequest(new URL(req.url).searchParams);
  if (!parsed.ok) {
    return new Response(parsed.message, { status: parsed.status });
  }

  const auth = await authorizeContactMessagesRestaurant(
    parsed.params.restaurantId,
  );
  if (!auth.ok) {
    return new Response("Unauthorized", { status: auth.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return new Response("Server error", { status: 503 });
  }

  return fetchMetaMediaProxyResponse(admin, parsed.params, "private");
}

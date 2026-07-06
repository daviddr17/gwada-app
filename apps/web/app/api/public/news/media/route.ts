import { enforcePublicApiReadRateLimit } from "@/lib/api/public-api-rate-limit";
import {
  fetchMetaMediaProxyResponse,
  parseMetaMediaProxyRequest,
} from "@/lib/contact-messages/meta-media-proxy-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

async function isPublishedRestaurant(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("restaurants")
    .select("id")
    .eq("id", restaurantId)
    .eq("is_published", true)
    .maybeSingle();
  return Boolean(data?.id);
}

/** Öffentlicher Meta-Medien-Proxy für News-Embeds (Graph-URLs brauchen Page-Token). */
export async function GET(req: Request) {
  const parsed = parseMetaMediaProxyRequest(new URL(req.url).searchParams);
  if (!parsed.ok) {
    return new Response(parsed.message, { status: parsed.status });
  }

  const rateLimited = enforcePublicApiReadRateLimit(
    req,
    parsed.params.restaurantId,
  );
  if (rateLimited) return rateLimited;

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return new Response("Server error", { status: 503 });
  }

  if (!(await isPublishedRestaurant(admin, parsed.params.restaurantId))) {
    return new Response("Not found", { status: 404 });
  }

  return fetchMetaMediaProxyResponse(admin, parsed.params, "public");
}

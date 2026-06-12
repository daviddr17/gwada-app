import { resolveMetaInboxAuth } from "@/lib/contact-messages/meta-inbox-auth-server";
import { authorizeContactMessagesRestaurant } from "@/lib/contact-messages/route-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Proxied Meta-Anhänge (Graph-URLs brauchen Page-Token). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("restaurantId");
  const platform = url.searchParams.get("platform");
  const mediaUrl = url.searchParams.get("url");

  const auth = await authorizeContactMessagesRestaurant(restaurantId);
  if (!auth.ok) {
    return new Response("Unauthorized", { status: auth.status });
  }

  if (
    !mediaUrl?.trim() ||
    (platform !== "facebook" && platform !== "instagram")
  ) {
    return new Response("Bad request", { status: 400 });
  }

  const parsed = new URL(mediaUrl);
  if (
    !parsed.hostname.endsWith("fbcdn.net") &&
    !parsed.hostname.endsWith("facebook.com") &&
    !parsed.hostname.endsWith("instagram.com")
  ) {
    return new Response("Forbidden", { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return new Response("Server error", { status: 503 });
  }

  const metaAuth = await resolveMetaInboxAuth(
    admin,
    auth.restaurantId,
    platform,
  );
  if (!metaAuth) {
    return new Response("Not connected", { status: 502 });
  }

  const fetchUrl = new URL(mediaUrl);
  fetchUrl.searchParams.set("access_token", metaAuth.pageAccessToken);

  const res = await fetch(fetchUrl.toString(), { cache: "no-store" });
  if (!res.ok) {
    return new Response("Upstream error", { status: 502 });
  }

  const contentType = res.headers.get("content-type") ?? "application/octet-stream";
  const bytes = await res.arrayBuffer();

  return new Response(bytes, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=300",
    },
  });
}

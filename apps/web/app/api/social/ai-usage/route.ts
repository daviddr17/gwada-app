import { authorizeSocialNewsRestaurant } from "@/lib/social/route-auth";
import { fetchRestaurantAiUsageSummary } from "@/lib/supabase/restaurant-ai-usage-db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Dein Verbrauch — Restaurant-KI Usage (Autopilot / Learn). */
export async function GET(req: Request) {
  const restaurantId =
    new URL(req.url).searchParams.get("restaurantId")?.trim() ?? "";
  const auth = await authorizeSocialNewsRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }
  const usage = await fetchRestaurantAiUsageSummary(admin, restaurantId);
  return Response.json({ usage });
}

import { assertCronAuthorized } from "@/lib/api/cron-auth";
import { generateSocialSuggestionsForRestaurant } from "@/lib/social/social-suggestion-generate-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Wöchentliche Vorschläge für alle Restaurants mit aktivem Brand Kit. */
export async function GET(req: Request) {
  const cronAuth = assertCronAuthorized(req);
  if (cronAuth) return cronAuth;

  const sb = createSupabaseAdminClient();
  if (!sb) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const { data: kits, error } = await sb
    .from("restaurant_social_brand_kit")
    .select("restaurant_id")
    .eq("enabled", true)
    .limit(500);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  let restaurants = 0;
  let created = 0;
  for (const row of kits ?? []) {
    const restaurantId = String(row.restaurant_id ?? "");
    if (!restaurantId) continue;
    restaurants += 1;
    const result = await generateSocialSuggestionsForRestaurant(
      sb,
      restaurantId,
    );
    created += result.created;
  }

  return Response.json({ restaurants, created });
}

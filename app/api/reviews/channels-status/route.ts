import { googleBusinessConfigFromJson } from "@/lib/integrations/google-business-oauth";
import { authorizeReviewsRestaurant } from "@/lib/reviews/route-auth";
import { fetchRestaurantFacebookIntegration } from "@/lib/supabase/restaurant-facebook-integration-db";
import { fetchRestaurantOAuthIntegration } from "@/lib/supabase/restaurant-oauth-integration-db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId =
    new URL(req.url).searchParams.get("restaurantId")?.trim() ?? "";

  const auth = await authorizeReviewsRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: "forbidden" }, { status: auth.status });
  }

  const googleRow = await fetchRestaurantOAuthIntegration(
    auth.sb,
    restaurantId,
    "google_business",
    googleBusinessConfigFromJson,
  );
  const facebookRow = await fetchRestaurantFacebookIntegration(
    auth.sb,
    restaurantId,
  );

  return Response.json({
    googleConnected: googleRow?.status === "working",
    facebookConnected: facebookRow?.status === "working",
  });
}

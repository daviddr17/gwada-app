import { loadGwadaReviewsOverviewProtocol } from "@/lib/reviews/gwada-review-protocol-server";
import { authorizeReviewsRestaurant } from "@/lib/reviews/route-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId =
    new URL(req.url).searchParams.get("restaurantId")?.trim() ?? "";

  const auth = await authorizeReviewsRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: "forbidden" }, { status: auth.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const data = await loadGwadaReviewsOverviewProtocol(admin, { restaurantId });
  return Response.json(data);
}

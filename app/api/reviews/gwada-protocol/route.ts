import { loadGwadaReviewProtocol } from "@/lib/reviews/gwada-review-protocol-server";
import { authorizeReviewsRestaurant } from "@/lib/reviews/route-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId =
    new URL(req.url).searchParams.get("restaurantId")?.trim() ?? "";
  const reviewId = new URL(req.url).searchParams.get("reviewId")?.trim() ?? "";

  if (!reviewId) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeReviewsRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: "forbidden" }, { status: auth.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const result = await loadGwadaReviewProtocol(admin, {
    restaurantId,
    reviewId,
  });

  if (result.error) {
    const status = result.error === "not_found" ? 404 : 500;
    return Response.json({ error: result.error }, { status });
  }

  return Response.json(result.data);
}

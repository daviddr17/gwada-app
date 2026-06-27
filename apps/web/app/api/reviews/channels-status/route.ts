import { authorizeReviewsRestaurant } from "@/lib/reviews/route-auth";
import { loadReviewPlatformConnectionState } from "@/lib/reviews/reviews-platform-connected-server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId =
    new URL(req.url).searchParams.get("restaurantId")?.trim() ?? "";

  const auth = await authorizeReviewsRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: "forbidden" }, { status: auth.status });
  }

  const state = await loadReviewPlatformConnectionState(restaurantId);

  return Response.json({
    googleConnected: state.googleConnected,
    facebookConnected: state.facebookConnected,
    googleVisible: state.googleVisible,
    facebookVisible: state.facebookVisible,
  });
}

import { authorizeReviewsRestaurant } from "@/lib/reviews/route-auth";
import { markAllReviewsReadForUserServer } from "@/lib/reviews/mark-all-reviews-read-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { restaurantId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const restaurantId = body.restaurantId?.trim() ?? "";
  const auth = await authorizeReviewsRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: "forbidden" }, { status: auth.status });
  }

  const result = await markAllReviewsReadForUserServer(auth.sb, {
    restaurantId,
    userId: auth.userId,
  });

  if (result.error) {
    return Response.json({ error: result.error }, { status: 502 });
  }

  return Response.json({ ok: true, count: result.count });
}

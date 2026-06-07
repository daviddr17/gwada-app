import { checkReviewInviteWhatsappNumber } from "@/lib/reviews/review-invitation-send-server";
import { authorizeReviewsRestaurant } from "@/lib/reviews/route-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { restaurantId?: string; guestPhone?: string };
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

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const result = await checkReviewInviteWhatsappNumber(admin, {
    restaurantId,
    guestPhone: body.guestPhone?.trim() ?? "",
  });

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json({ exists: result.exists });
}

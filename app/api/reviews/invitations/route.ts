import {
  createManualGwadaReviewInvitation,
} from "@/lib/reviews/review-invitation-send-server";
import { authorizeReviewsRestaurant } from "@/lib/reviews/route-auth";
import { getPublicSiteUrl } from "@/lib/public-env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const origin =
    req.headers.get("origin")?.trim() ||
    getPublicSiteUrl()?.trim() ||
    undefined;

  const userSb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await userSb.auth.getUser();

  const result = await createManualGwadaReviewInvitation(admin, {
    restaurantId,
    origin,
    createdByUserId: user?.id ?? null,
  });

  if ("error" in result) {
    const status =
      result.error === "not_found"
        ? 404
        : result.error === "origin_missing"
          ? 503
          : 500;
    return Response.json({ error: result.error }, { status });
  }

  return Response.json(result);
}

import { authorizeSocialNewsRestaurant } from "@/lib/social/route-auth";
import { generateSocialSuggestionsForRestaurant } from "@/lib/social/social-suggestion-generate-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    force?: boolean;
  };
  const restaurantId = body.restaurantId?.trim() ?? "";
  const auth = await authorizeSocialNewsRestaurant(restaurantId, {
    requireManage: true,
  });
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const generation = await generateSocialSuggestionsForRestaurant(
    admin,
    restaurantId,
    { force: body.force === true },
  );

  return Response.json({ ok: true, generation });
}

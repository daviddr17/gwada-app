import { authorizeSocialNewsRestaurant } from "@/lib/social/route-auth";
import { skipSocialSuggestion } from "@/lib/social/social-suggestion-actions-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: suggestionId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
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

  const result = await skipSocialSuggestion({
    sb: admin,
    restaurantId,
    suggestionId,
  });

  if (!result.ok) {
    return Response.json(
      { error: result.error },
      { status: result.error === "not_found" ? 404 : 500 },
    );
  }

  return Response.json({ ok: true });
}

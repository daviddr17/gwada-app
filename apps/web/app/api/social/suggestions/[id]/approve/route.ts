import { authorizeSocialNewsRestaurant } from "@/lib/social/route-auth";
import { approveSocialSuggestion } from "@/lib/social/social-suggestion-actions-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: suggestionId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    caption?: string;
    publishNow?: boolean;
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

  const result = await approveSocialSuggestion({
    sb: admin,
    restaurantId,
    suggestionId,
    caption: typeof body.caption === "string" ? body.caption : undefined,
    publishNow: body.publishNow === true,
  });

  if (!result.ok) {
    const status =
      result.error === "not_found"
        ? 404
        : result.error === "image_required" ||
            result.error === "caption_required" ||
            result.error === "invalid_status"
          ? 400
          : 500;
    return Response.json({ error: result.error }, { status });
  }

  return Response.json(result);
}

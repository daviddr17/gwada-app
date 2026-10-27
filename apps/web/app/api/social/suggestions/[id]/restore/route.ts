import { authorizeSocialNewsRestaurant } from "@/lib/social/route-auth";
import { restoreSavedSocialSuggestionInDb } from "@/lib/social/social-suggestions-db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Gespeicherte Vorlage zurück in die Freigabe-Queue. */
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
  const result = await restoreSavedSocialSuggestionInDb(admin, {
    restaurantId,
    suggestionId,
  });
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({ ok: true });
}

import { authorizeSocialNewsRestaurant } from "@/lib/social/route-auth";
import { listSocialKiCues } from "@/lib/social/social-ki-cues-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Leichte Feiertags-/Event-Hinweise für KI-Post — kein LLM. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("restaurantId")?.trim() ?? "";

  const auth = await authorizeSocialNewsRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const cues = await listSocialKiCues(admin, restaurantId);
  return Response.json({ cues });
}

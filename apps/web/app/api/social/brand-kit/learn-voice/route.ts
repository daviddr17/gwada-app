import { authorizeSocialBrandKitRestaurant } from "@/lib/social/route-auth";
import { draftSocialBrandVoiceFromFeed } from "@/lib/social/social-brand-learn-voice-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Opt-in: Stimme aus IG/FB-Cache vorschlagen — schreibt nicht ohne Confirm.
 * Confirm = bestehendes PUT /api/social/brand-kit.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
  };
  const restaurantId = body.restaurantId?.trim() ?? "";
  const auth = await authorizeSocialBrandKitRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }
  const result = await draftSocialBrandVoiceFromFeed(admin, restaurantId);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({ ok: true, draft: result.draft });
}

import { authorizeSocialNewsRestaurant } from "@/lib/social/route-auth";
import { SOCIAL_TONES, type SocialTone } from "@/lib/social/social-brand-kit";
import { generateSocialSuggestionsForRestaurant } from "@/lib/social/social-suggestion-generate-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Caption/Media-Generate nur für gewählte Ideen (Restaurant-KI-Key). */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    ideaIds?: unknown;
    tone?: unknown;
    platforms?: unknown;
  };
  const restaurantId = body.restaurantId?.trim() ?? "";
  const ideaIds = Array.isArray(body.ideaIds)
    ? body.ideaIds.filter((id): id is string => typeof id === "string")
    : [];
  const tone =
    typeof body.tone === "string" &&
    SOCIAL_TONES.includes(body.tone as SocialTone)
      ? (body.tone as SocialTone)
      : undefined;
  const platforms = Array.isArray(body.platforms)
    ? body.platforms.filter((p): p is string => typeof p === "string")
    : undefined;

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

  if (ideaIds.length === 0) {
    return Response.json(
      { error: "selection_required", generation: { created: 0 } },
      { status: 400 },
    );
  }

  const generation = await generateSocialSuggestionsForRestaurant(
    admin,
    restaurantId,
    { ideaIds, tone, platforms },
  );

  return Response.json({ ok: true, generation });
}

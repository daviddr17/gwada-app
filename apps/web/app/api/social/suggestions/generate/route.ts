import { authorizeSocialNewsRestaurant } from "@/lib/social/route-auth";
import { parseSocialAutopilotIdeaHints } from "@/lib/social/social-autopilot-ideas";
import { SOCIAL_TONES, type SocialTone } from "@/lib/social/social-brand-kit";
import { parseSocialMediaFormatId } from "@/lib/social/social-media-formats";
import {
  parseAutopilotGalleryIds,
  parseAutopilotMenuIds,
} from "@/lib/social/social-autopilot-selection-server";
import {
  generateSocialSuggestionsForRestaurant,
  parseSocialAutopilotSources,
} from "@/lib/social/social-suggestion-generate-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Caption/Media-Generate über die Restaurant-KI (OpenAI/Grok aus Integrationen).
 * KI-Post: menuIds / galleryIds / styleOnly → genau ein Post.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    ideaIds?: unknown;
    ideaHints?: unknown;
    menuIds?: unknown;
    galleryIds?: unknown;
    styleOnly?: unknown;
    sources?: unknown;
    count?: unknown;
    tone?: unknown;
    platforms?: unknown;
    mediaFormat?: unknown;
    asNewsDrafts?: unknown;
  };
  const restaurantId = body.restaurantId?.trim() ?? "";
  const ideaIds = Array.isArray(body.ideaIds)
    ? body.ideaIds.filter((id): id is string => typeof id === "string")
    : [];
  const menuIds = parseAutopilotMenuIds(body.menuIds);
  const galleryIds = parseAutopilotGalleryIds(body.galleryIds);
  const styleOnly = body.styleOnly === true;
  const sources = parseSocialAutopilotSources(body.sources);
  const ideaHints = parseSocialAutopilotIdeaHints(body.ideaHints);
  const tone =
    typeof body.tone === "string" &&
    SOCIAL_TONES.includes(body.tone as SocialTone)
      ? (body.tone as SocialTone)
      : undefined;
  const platforms = Array.isArray(body.platforms)
    ? body.platforms.filter((p): p is string => typeof p === "string")
    : undefined;
  const mediaFormat = parseSocialMediaFormatId(body.mediaFormat) ?? undefined;

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

  const selectionMode =
    menuIds.length > 0 || galleryIds.length > 0 || styleOnly;
  if (ideaIds.length === 0 && !selectionMode && sources.length === 0) {
    return Response.json(
      { error: "selection_required", generation: { created: 0 } },
      { status: 400 },
    );
  }

  const asNewsDrafts = body.asNewsDrafts === true;
  const generation = await generateSocialSuggestionsForRestaurant(
    admin,
    restaurantId,
    {
      ideaIds,
      ideaHints,
      menuIds,
      galleryIds,
      styleOnly,
      sources,
      count: 1,
      tone,
      platforms,
      mediaFormat,
      asNewsDrafts,
      userId: auth.userId,
    },
  );

  return Response.json({ ok: true, generation });
}

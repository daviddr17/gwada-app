import { authorizeSocialNewsRestaurant } from "@/lib/social/route-auth";
import { SOCIAL_FEED_LAYOUT_IDS } from "@/lib/social/social-feed-brand-system";
import type { SocialFeedLayoutId } from "@/lib/social/social-feed-brand-system";
import {
  fetchSocialSuggestionFromDb,
  updateSocialSuggestionFieldsInDb,
} from "@/lib/social/social-suggestions-db";
import type { SocialSuggestionAsset } from "@/lib/social/social-suggestion-types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function parseAsset(raw: unknown): SocialSuggestionAsset | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const imageUrl =
    typeof r.imageUrl === "string" && r.imageUrl.trim()
      ? r.imageUrl.trim()
      : null;
  const source =
    r.source === "gallery" ||
    r.source === "menu" ||
    r.source === "profile" ||
    r.source === "event" ||
    r.source === "none"
      ? r.source
      : "none";
  return {
    imageUrl,
    imageLabel:
      typeof r.imageLabel === "string" ? r.imageLabel.slice(0, 120) : undefined,
    source,
    sourceId: typeof r.sourceId === "string" ? r.sourceId : undefined,
    storageBucket:
      typeof r.storageBucket === "string" ? r.storageBucket : undefined,
    storagePath: typeof r.storagePath === "string" ? r.storagePath : undefined,
  };
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: suggestionId } = await ctx.params;
  const restaurantId =
    new URL(req.url).searchParams.get("restaurantId")?.trim() ?? "";
  const auth = await authorizeSocialNewsRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  const suggestion = await fetchSocialSuggestionFromDb(
    auth.sb,
    restaurantId,
    suggestionId,
  );
  if (!suggestion) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return Response.json({ suggestion });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: suggestionId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    title?: string | null;
    caption?: string;
    asset?: unknown;
    feedLayout?: string;
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

  const feedLayout =
    typeof body.feedLayout === "string" &&
    SOCIAL_FEED_LAYOUT_IDS.includes(body.feedLayout as SocialFeedLayoutId)
      ? (body.feedLayout as SocialFeedLayoutId)
      : undefined;

  const result = await updateSocialSuggestionFieldsInDb(admin, {
    restaurantId,
    suggestionId,
    title: body.title,
    caption: typeof body.caption === "string" ? body.caption : undefined,
    asset: body.asset !== undefined ? parseAsset(body.asset) ?? undefined : undefined,
    feedLayout,
  });

  if (!result.ok) {
    const status =
      result.error === "not_found"
        ? 404
        : result.error === "invalid_status"
          ? 400
          : 500;
    return Response.json({ error: result.error }, { status });
  }

  return Response.json({ ok: true, suggestion: result.suggestion });
}

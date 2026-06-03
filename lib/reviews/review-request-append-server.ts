import "server-only";

import { getPublicSiteUrl } from "@/lib/public-env";
import {
  buildReviewRequestBlock,
  ensureGwadaReviewInvitation,
  reviewRequestSettingsFromRow,
} from "@/lib/reviews/gwada-review-invitation-server";
import { oauthConfigFromJson, type MetaOAuthIntegrationConfig } from "@/lib/integrations/oauth-integration-types";
import { fetchRestaurantOAuthIntegrationAdmin } from "@/lib/supabase/restaurant-oauth-integration-db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

function facebookReviewUrl(pageId: string | undefined): string | null {
  if (!pageId?.trim()) return null;
  return `https://www.facebook.com/${pageId.trim()}/reviews`;
}

export async function appendReviewRequestToMessage(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    reservationId: string;
    text: string;
    origin?: string;
  },
): Promise<string> {
  const admin = createSupabaseAdminClient();
  if (!admin) return params.text;

  const { data: settingsRow } = await sb
    .from("restaurant_reservation_settings")
    .select(
      "review_request_enabled, review_request_include_gwada, review_request_include_google, review_request_include_facebook, review_google_url, review_facebook_url",
    )
    .eq("restaurant_id", params.restaurantId)
    .maybeSingle();

  const settings = reviewRequestSettingsFromRow(
    settingsRow as Record<string, unknown> | null,
  );
  if (!settings.review_request_enabled) return params.text;

  let invitationToken: string | null = null;
  if (settings.review_request_include_gwada) {
    const inv = await ensureGwadaReviewInvitation(admin, {
      restaurantId: params.restaurantId,
      reservationId: params.reservationId,
    });
    invitationToken = inv?.token ?? null;
  }

  const fbRow = settings.review_request_include_facebook
    ? await fetchRestaurantOAuthIntegrationAdmin(
        params.restaurantId,
        "facebook",
        (raw) => oauthConfigFromJson<MetaOAuthIntegrationConfig>(raw),
      )
    : null;

  const origin =
    params.origin?.replace(/\/$/, "") ??
    getPublicSiteUrl()?.replace(/\/$/, "") ??
    "http://localhost:3000";

  const block = buildReviewRequestBlock({
    origin,
    settings,
    invitationToken,
    googleReviewUrl: settings.review_google_url,
    facebookReviewUrl:
      settings.review_facebook_url ??
      facebookReviewUrl(fbRow?.config.page_id),
  });

  if (!block.trim()) return params.text;
  return `${params.text.trim()}${block}`;
}

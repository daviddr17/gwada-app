import "server-only";

import { getPublicSiteUrl } from "@/lib/public-env";
import type { ReviewRequestChannel } from "@/lib/reviews/review-request-settings";
import { reservationGuestAlreadyReviewed } from "@/lib/reviews/contact-gwada-review-server";
import {
  buildReviewRequestBlock,
  ensureGwadaReviewInvitation,
  hasAnyReviewInclude,
  reviewRequestSettingsFromRow,
} from "@/lib/reviews/gwada-review-invitation-server";
import { resolveGoogleReviewUrlFromBusiness } from "@/lib/reviews/google-review-url-server";
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
    channel: ReviewRequestChannel;
  },
): Promise<string> {
  const admin = createSupabaseAdminClient();
  if (!admin) return params.text;

  const { data: settingsRow } = await sb
    .from("restaurant_reservation_settings")
    .select(
      "review_request_enabled, review_request_include_gwada, review_request_include_google, review_request_include_facebook, whatsapp_review_include_gwada, whatsapp_review_include_google, whatsapp_review_include_facebook, email_review_include_gwada, email_review_include_google, email_review_include_facebook, review_google_url, review_facebook_url",
    )
    .eq("restaurant_id", params.restaurantId)
    .maybeSingle();

  const settings = reviewRequestSettingsFromRow(
    settingsRow as Record<string, unknown> | null,
    params.channel,
  );
  if (!hasAnyReviewInclude(settings)) return params.text;

  if (await reservationGuestAlreadyReviewed(admin, {
    restaurantId: params.restaurantId,
    reservationId: params.reservationId,
  })) {
    return params.text;
  }

  let invitationToken: string | null = null;
  if (settings.includeGwada) {
    const inv = await ensureGwadaReviewInvitation(admin, {
      restaurantId: params.restaurantId,
      reservationId: params.reservationId,
    });
    invitationToken = inv?.token ?? null;
    if (!invitationToken) {
      console.warn(
        "appendReviewRequest: Gwada-Einladung fehlgeschlagen",
        params.reservationId,
      );
    }
  }

  const fbRow = settings.includeFacebook
    ? await fetchRestaurantOAuthIntegrationAdmin(
        params.restaurantId,
        "facebook",
        (raw) => oauthConfigFromJson<MetaOAuthIntegrationConfig>(raw),
      )
    : null;

  let googleReviewUrl = settings.review_google_url;
  if (settings.includeGoogle && !googleReviewUrl) {
    googleReviewUrl = await resolveGoogleReviewUrlFromBusiness(
      params.restaurantId,
    );
  }

  const origin =
    params.origin?.replace(/\/$/, "") ??
    getPublicSiteUrl()?.replace(/\/$/, "") ??
    "https://gwada.app";

  const block = buildReviewRequestBlock({
    origin,
    settings,
    invitationToken,
    googleReviewUrl,
    facebookReviewUrl:
      settings.review_facebook_url ??
      facebookReviewUrl(fbRow?.config.page_id),
  });

  if (!block.trim()) {
    if (hasAnyReviewInclude(settings)) {
      console.warn(
        "appendReviewRequest: keine Links gebaut (Token/URL fehlt)",
        {
          reservationId: params.reservationId,
          channel: params.channel,
          includeGwada: settings.includeGwada,
          includeGoogle: settings.includeGoogle,
          hasToken: Boolean(invitationToken),
          hasGoogleUrl: Boolean(googleReviewUrl),
        },
      );
    }
    return params.text;
  }
  return `${params.text.trim()}${block}`;
}

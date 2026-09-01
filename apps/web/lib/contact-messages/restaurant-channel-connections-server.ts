import "server-only";

import { resolveRestaurantImapCredentials } from "@/lib/contact-messages/email-inbox-service";
import {
  oauthConfigFromJson,
  type MetaOAuthIntegrationConfig,
} from "@/lib/integrations/oauth-integration-types";
import {
  assertPlatformEmailEnabled,
  assertPlatformFacebookEnabled,
  assertPlatformInstagramEnabled,
  assertPlatformWhatsappEnabled,
} from "@/lib/integrations/platform-messaging-guard";
import { isMetaReviewDemoRestaurantSlug } from "@/lib/restaurants/meta-review-demo";
import { canSendStaffInviteEmail } from "@/lib/staff/staff-invite-send-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchRestaurantOAuthIntegration } from "@/lib/supabase/restaurant-oauth-integration-db";
import { wahaGetSession } from "@/lib/waha/waha-client";
import { getWahaServerConfigForRestaurantAdmin } from "@/lib/waha/waha-config";
import { wahaSessionNameForRestaurant } from "@/lib/waha/waha-session-name";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { RestaurantChannelConnectionsPayload } from "@/lib/contact-messages/restaurant-channel-connections-types";

export type { RestaurantChannelConnectionsPayload };

export async function resolveRestaurantChannelConnectionsServer(params: {
  restaurantId: string;
  supabase: SupabaseClient;
}): Promise<RestaurantChannelConnectionsPayload> {
  const admin = createSupabaseAdminClient();

  let metaReviewDemo = false;
  if (admin) {
    const { data: rest } = await admin
      .from("restaurants")
      .select("slug")
      .eq("id", params.restaurantId)
      .maybeSingle();
    metaReviewDemo = isMetaReviewDemoRestaurantSlug(
      (rest as { slug?: string } | null)?.slug,
    );
  }

  const waPlatform = metaReviewDemo
    ? ({ ok: false as const, error: "whatsapp_disabled" as const })
    : await assertPlatformWhatsappEnabled(params.supabase);
  const emPlatform = await assertPlatformEmailEnabled(params.supabase);
  const fbPlatform = await assertPlatformFacebookEnabled(params.supabase);
  const igPlatform = await assertPlatformInstagramEnabled(params.supabase);

  let whatsappConnected = false;
  if (waPlatform.ok) {
    const config = await getWahaServerConfigForRestaurantAdmin(params.restaurantId);
    if (admin && config) {
      const session = wahaSessionNameForRestaurant(params.restaurantId);
      const live = await wahaGetSession(config, session);
      whatsappConnected = live.ok && live.data?.status === "WORKING";
    }
  }

  let emailConnected = false;
  if (emPlatform.ok && admin) {
    const creds = await resolveRestaurantImapCredentials(admin, params.restaurantId);
    emailConnected = creds != null;
  }

  let facebookConnected = false;
  if (fbPlatform.ok) {
    const fbRow = await fetchRestaurantOAuthIntegration(
      params.supabase,
      params.restaurantId,
      "facebook",
      (raw) => oauthConfigFromJson<MetaOAuthIntegrationConfig>(raw),
    );
    facebookConnected = fbRow?.status === "working";
  }

  let instagramConnected = false;
  if (igPlatform.ok) {
    const igRow = await fetchRestaurantOAuthIntegration(
      params.supabase,
      params.restaurantId,
      "instagram",
      (raw) => oauthConfigFromJson<MetaOAuthIntegrationConfig>(raw),
    );
    instagramConnected = igRow?.status === "working";
  }

  const staffInviteEmailAvailable =
    emPlatform.ok &&
    (await canSendStaffInviteEmail(params.restaurantId, params.supabase));

  return {
    whatsappEnabled: waPlatform.ok,
    emailEnabled: emPlatform.ok,
    facebookEnabled: fbPlatform.ok,
    instagramEnabled: igPlatform.ok,
    whatsappConnected,
    emailConnected,
    facebookConnected,
    instagramConnected,
    staffInviteEmailAvailable,
  };
}

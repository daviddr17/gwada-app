import "server-only";

import { resolveRestaurantImapCredentials } from "@/lib/contact-messages/email-inbox-service";
import { isMetaReviewDemoRestaurantSlug } from "@/lib/restaurants/meta-review-demo";
import { fetchRestaurantEmailIntegration } from "@/lib/supabase/restaurant-email-integration-db";
import { fetchRestaurantWhatsappIntegration } from "@/lib/supabase/restaurant-integrations-db";
import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificationChannelsInfo = {
  whatsappConnected: boolean;
  /** false = WhatsApp-Kanal in der UI komplett ausblenden (z. B. Meta Review Demo). */
  whatsappChannelVisible: boolean;
  restaurantEmailConfigured: boolean;
  /** Plattform-SMTP als Fallback, wenn keine Restaurant-Mailbox. */
  platformEmailFallbackAvailable: boolean;
};

export async function loadNotificationChannelsInfo(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<NotificationChannelsInfo> {
  const [{ data: rest }, whatsappRow, emailRow, imapCreds] = await Promise.all([
    admin.from("restaurants").select("slug").eq("id", restaurantId).maybeSingle(),
    fetchRestaurantWhatsappIntegration(admin, restaurantId),
    fetchRestaurantEmailIntegration(admin, restaurantId),
    resolveRestaurantImapCredentials(admin, restaurantId),
  ]);

  const metaReviewDemo = isMetaReviewDemoRestaurantSlug(
    typeof rest?.slug === "string" ? rest.slug : null,
  );

  const restaurantEmailConfigured =
    Boolean(imapCreds) ||
    ((emailRow?.status === "custom" ||
      emailRow?.status === "gmail" ||
      emailRow?.status === "outlook") &&
      Boolean(emailRow.config?.from_email ?? emailRow.config?.email));

  return {
    whatsappConnected: metaReviewDemo
      ? false
      : whatsappRow?.status === "working",
    whatsappChannelVisible: !metaReviewDemo,
    restaurantEmailConfigured,
    platformEmailFallbackAvailable: true,
  };
}
